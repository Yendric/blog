---
template: post
title: Wait, wasn't that pointer freed? (Firefox Use-After-Free)
description: "Finding a use-after-free in Firefox by accident, using view transitions and canvases (CVE-2026-124906)"
date: 2026-11-26
author: Yendric
tags:
    - Security
    - Firefox
    - C++
    - texyon
---

A little over a month ago I was editing a LaTeX document in a pre-release version of <a href="https://yendric.be/introducing-texyon/" target="_blank">TeXyoN</a> together with <a href="https://yarne.me" target="_blank">Yarne Ramakers</a>. I had just added some view-transition api animations to the demo web editor, and when Yarne switched from the editor view to the project page, his browser crashed. I tried the same, and my browser crashed too.

I thought out loud: "surely this isn't a low-level memory bug", as we had just had a week full of bugs like <a href="https://www.php2shell.com/" target="_blank">PHP2Shell</a> and Node2Shell. I then immediately started up a nightly ASAN build of Firefox and did the same there. Soon after, I was greeted with the magic words `SUMMARY: AddressSanitizer: heap-use-after-free`.

## Initial investigation

When the crash happened, we obviously had no idea what was happening under the hood. The only thing that was clear to me is that it was likely related to the view-transitions I had just added. Luckily ASAN adds a _lot_ of helpful information on where exactly the bug is happening, including stack traces of what freed the pointer and what used it after.

Somewhat surprisingly, these stack traces did not directly mention the recently added view-transitions, but rather they pointed towards inter-process communication (IPC) code.

A bit of background first. Firefox runs websites in separate **content processes**, which are sandboxed and aren't allowed to draw to the screen themselves. Instead, a content process describes what the page should look like and sends that to the parent process, which does the actual drawing (on Windows & macOS this is in a separate GPU process, for simplicity this post focuses on Linux, where it's the parent process). Images, like the contents of a canvas, are sent along as **textures**, which are blocks of pixel data that the GPU can draw.

Both processes need to agree on which texture is which, so every texture is represented on both sides by an **actor**. Each actor represents one side of a small IPC conversation about that one object. In the content process this is a `TextureChild`, in the parent a `TextureParent`. Messages refer to an actor by a numeric ID.

The freed object was a `TextureChild`, the content process's end of a texture. It was freed (`TextureChild::Release()`) while handling an IPC message from the parent process that told it to do so. Later, it was read again (`TextureChild::Id()`) while sending a queued message that still referred to it back to the parent.

## Constructing a small proof of concept

After reading a bit of the code we had a rough idea of what was going on. For our report to Mozilla, we needed a small proof of concept that would reliably trigger it and clearly shows what is going on.

We started by giving the application code of the crashing page to several LLMs, asking them to strip it down, keeping only the pieces we thought were relevant to trigger the bug (the canvases, the view transition, and maybe something that loads the page). Many LLMs simply refused once the three letters U, A & F were mentioned (we didn't have access to Anthropic's cyber verification program at the time), but we got some attempts out of them. Most didn't trigger the bug at all, though some did but were inconsistent or relatively large. Still, it gave us a great starting point that we used to create the final proof of concept. Below you can find an even more reduced version of what we initially included in our report:

```html
<canvas></canvas>
<script>
    const canvas = document.querySelector("canvas");
    createImageBitmap(canvas).then((bitmap) => {
        canvas.getContext("bitmaprenderer").transferFromImageBitmap(bitmap);
        requestAnimationFrame(() => requestAnimationFrame(() => document.startViewTransition()));
    });
</script>
```

The PoC does three things: it creates an `ImageBitmap`, puts it on a canvas, and then starts a view transition (that changes nothing!). In the vulnerable versions, these couple of lines immediately trigger the bug. Isn't that neat?

### Why does this crash?

Two `requestAnimationFrame()`s are used to ensure the view transition is started after the canvas has been painted with the bitmap. Every time Firefox paints the canvas, it uploads the bitmap into a new texture (even if it didn't change). At that point, the old texture is no longer needed, so the content process asks the parent process to do two things about it: 1) stop using it (`OpRemoveTexture`) and 2) destroy its actor in the parent (`TextureParent`, via `OpDestroy`). Both are queued and sent in the next message from the content process to the parent process that contains the freshly painted version of the page. Once the parent has destroyed its side of the texture, it replies with a `__delete__` message, at which point the content process frees its actor (`TextureChild::Release()`).

This is where the view transition comes into play (my gut feeling was right!). A view transition animates between the page before and after a change. To do so, it first paints a snapshot of the page as it currently is. Key here is that this paint is special, it is sent as an _offscreen transaction_, which the parent computes for the animation, but doesn't show on screen. The snapshot also repaints our canvas, meaning the old texture gets dropped (as described above) in the middle of this offscreen transaction. That is where it all goes wrong, which I will now illustrate using the code.

## The actual faulty code

### Two messages, two queues

The `OpRemoveTexture` and `OpDestroy` messages are queued in `WebRenderBridgeChild`, the content process's end of the connection to the parent's renderer. The texture removal is queued like this:

```cpp
void WebRenderBridgeChild::RemoveTextureFromCompositable(
    CompositableClient* aCompositable, TextureClient* aTexture) {
  ...
  AddWebRenderParentDestroyCommand(CompositableOperation(
      aCompositable->GetIPCHandle(),
      OpRemoveTexture(WrapNotNull(aTexture->GetIPDLActor()))));
}
```

`GetIPDLActor()` returns a plain `PTextureChild*`, meaning the `OpRemoveTexture` holds a raw pointer to the `TextureChild`! The `OpDestroy` for the same texture goes into a separate list, `mDestroyedActors`. Both are sent in `EndTransaction`, but not under the same conditions:

```cpp
bool WebRenderBridgeChild::EndTransaction(..., bool aRenderOffscreen, ...) {
  if (!aRenderOffscreen) {
    MergeWebRenderParentCommands(); // adds the held-back OpRemoveTexture
  }
  aDisplayListData.mCommands = std::move(mParentCommands);

  SendSetDisplayList(std::move(aDisplayListData), mDestroyedActors, ...);

  if (!aRenderOffscreen) {
    ProcessWebRenderParentCommands();
  }
  mDestroyedActors.Clear();
}
```

As you can see, in a regular transaction both go out together. In an offscreen transaction like our view transition snapshot, however, `OpDestroy` is sent but `OpRemoveTexture` stays in the queue until the next regular transaction.

### Reading a freed actor

It is now clear how the UAF occurs. The parent process receives the `OpDestroy`, destroys its side of the texture, and replies with `__delete__`. The content process then handles this _before_ the next regular transaction, freeing the `TextureChild`. Finally, when the next regular transaction is sent, it still contains the queued `OpRemoveTexture`, which holds a pointer to the now freed `TextureChild`. When the content process tries to send that message, it reads the actor ID from the freed pointer, resulting in a UAF:

```cpp
void ParamTraits<mozilla::ipc::IProtocol*>::Write(MessageWriter* aWriter,
                                                  const paramType& aParam) {
  ...
  id = aParam->Id(); // aParam is the freed TextureChild
  ...
  IPC::WriteParam(aWriter, id);
}
```

### Step by step

Below is an interactive diagram that takes you through the different steps of the bug.

<UafSequence variants={["deferred"]} />

## Can we do anything with this?

At first sight, a use-after-free issue sounds really scary. But of course, what you can actually do with it depends on what the code does with the freed memory. Here, (un)fortunately, that's not much. All it does is read the actor Id and then run some checks:

```cpp
id = aParam->Id();
MOZ_RELEASE_ASSERT(id != kNullActorId, ...);
MOZ_RELEASE_ASSERT(aParam->CanSend(), ...);
MOZ_RELEASE_ASSERT(aWriter->GetActor()->GetIPCChannel() == aParam->GetIPCChannel(), ...);
```

In theory a page could take over the freed memory and put arbitrary data there. The `TextureChild` object is 144 bytes in size, and a page could try to create a lot of objects of similar size hoping one lands in this freed spot. To get past above IPC checks, however, the new data needs to look like a valid live actor.

The parent process always treats the data it gets from a content process as untrusted, so it too does some sanity checks. It, for example, checks that the actor Id supplied is actually valid, and crashes if it isn't. This means the only thing we could realistically do is supply another TextureChild, in which case the parent would remove a different, still used texture (which are refcounted in the parent, so not a problem). Nothing ever gets leaked to the content process either.

Another thing you might be thinking about is hijacking the vtable of the freed object. Unfortunately, no virtual functions are called on the object after the free, so that avenue is closed too. Together this means we didn't see a path for this bug to do anything beyond a crash. Mozilla rated it as moderate, but it still got a CVSS 8.8 HIGH with <a href="https://www.cve.org/CVERecord?id=CVE-2026-124906" target="_blank">CVE-2026-124906</a>. This is mostly because the score goes off of the title and description of the bug, which is a UAF in a browser. The actual impact is much lower. Still, I'm very happy having received a CVE for my first Firefox security report, and I hope to get more in the future!

## The fix

The fix is quite short and simply holds back `OpDestroy` in offscreen transactions too, so both ops leave together again:

```diff
+  nsTArray<OpDestroy> destroyedActors;
   if (!aRenderOffscreen) {
     MergeWebRenderParentCommands();
+    destroyedActors = std::move(mDestroyedActors);
   }
   ...
-  SendSetDisplayList(std::move(aDisplayListData), mDestroyedActors, ...);
+  SendSetDisplayList(std::move(aDisplayListData), destroyedActors, ...);
   ...
-  mDestroyedActors.Clear();
```

## It was introduced... twice?

### Bisecting with mozregression

For our report we also wanted to know when this bug was introduced. Mozilla has a great tool for this, called mozregression. You can give it a date where things were fine and one where they were broken, and it does a binary search over Firefox's nightly builds to find when it was introduced. I used a small script to automatically run the PoC for every build and decide whether it crashes.

<BisectRange good="2025-07-01" bad="2025-10-01" badLabel="crash" culprit="bug 1982053" steps={[
["2025-08-16", "good"],
["2025-09-08", "bad"],
["2025-08-28", "bad"],
["2025-08-22", "bad"],
["2025-08-19", "bad"],
["2025-08-18", "good"]
]} />

This yielded a single date, August 19th 2025 (over a year ago!), after which the bug was present. Looking at the code changes of that day, there is one clear candidate for introducing the bug: <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1982053" target="_blank">bug 1982053</a>, as it was the only one modifying the message code.

### Crashing the whole browser

That should have been the end of the story, but weirdly enough the browser fully crashed with an IPC error here, and didn't trigger the UAF we found in the nightly build. Finding out why can be done by looking at the actual codechange from this bug. It was itself a fix for a problem where Firefox crashed on removal of a video pipeline while it was still in use. It fixed it by holding back removals in offscreen transactions, by putting them in a separate queue:

```diff
 void WebRenderBridgeChild::RemoveTextureFromCompositable(...) {
-  AddWebRenderParentCommand(CompositableOperation(
+  AddWebRenderParentDestroyCommand(CompositableOperation(
       aCompositable->GetIPCHandle(),
       OpRemoveTexture(WrapNotNull(aTexture->GetIPDLActor()))));
```

It is from this moment on that `OpDestroy` gets treated separately from `OpRemoveTexture`. In this version, however, the held back messages didn't wait for long and were sent immediately after the offscreen transaction. At that point, the `TextureChild` hasn't been freed yet, so there is no UAF. Instead, the parent process deals with the messages in order: it destroys the texture (`OpDestroy`), and then gets a message asking to remove a texture (`OpRemoveTexture`) that no longer exists. It catches this and crashes on purpose (again, because it treats content process data as untrusted):

```
IPDL protocol error: Error deserializing managed PTexture actor
Hit MOZ_CRASH(IPC FatalError in the parent process!)
```

So, for a year, any web page could crash the entire browser with only a few lines of javascript. (As stated before, the explanation here uses the Linux parent process. On Windows, where a separate GPU process is used, you need to run the PoC in a loop to achieve a full crash)

### From crash to use-after-free

The use-after-free itself, however, was only introduced in a later change, <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=2078982" target="_blank">bug 2078982</a>, which made the held back messages wait until the next regular transaction:

```diff
-  ProcessWebRenderParentCommands();
+  if (!aRenderOffscreen) {
+    ProcessWebRenderParentCommands();
+  }
```

That introduces the UAF we found. This means it was a very big coincidence we even stumbled on the use after free. First, it triggered completely by accident by editing a LaTeX document in the browser. Second, in our regular Firefox the trigger only caused an IPC error crash, but testing it in the nightly ASAN build revealed the UAF. At that point the UAF hadn't reached a stable release yet, but it was already in beta and shipped in Firefox 159 and ESR 153.6 five days later. Had our timing been a bit different, or had I not added animations to the editor, we would never have found this bug.

## Timeline

The total timeline from our browsers crashing to reporting it to Mozilla looks as follows:

- **October 22nd, 2026**: TeXyoN's editor crashes Firefox, and ASAN shows a heap-use-after-free
- **October 24th**: we report it to Mozilla as bug 2086296
- **October ~28th**: Mozilla's own automated testing finds the same bug independently, a couple of days after our report. That meant no bounty for us (within 7 day window), but we still got credited for the CVE
- **November 1st**: the fix lands, eight days after our report
- **November 10th**: Firefox 160 ships with the fix, as <a href="https://www.cve.org/CVERecord?id=CVE-2026-124906" target="_blank">CVE-2026-124906</a>

We want to thank and congratulate the Mozilla security team for their kindness and responsiveness, from reporting to fixing the issue only took about a week.

## Conclusion

What started as a crash while editing a LaTeX document turned into quite the rabbit hole. In the end, a nightly ASAN build and a lot of curiosity were enough to go from a browser crash to a CVE.

The bisecting tool was also very useful to find the culprit commits. Interestingly, neither faulty commit is really to blame on its own. Both were sensible changes, made a year apart, but together they broke an unwritten rule. That is, the `OpRemoveTexture` and `OpDestroy` for the same texture should always leave together.

We also learned a lot by making the PoC smaller, even long after we reported the bug. Going from an LLM-stripped editor to a handful of lines is what made us understand why and how the bug triggers in the first place.

The real-world impact of the UAF turned out to be limited. Still, there was the possibility to crash the entire browser with a couple of lines of javascript.

Finally, Mozilla fixed this really quickly, and their own automation found the same bug just four days after our report. A very important takeaway from this experience: if you ever find something, don't sit on it, report it!
