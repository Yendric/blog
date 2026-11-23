---
template: post
title: Oxidized LaTeX at keystroke speed
description: Why I ported XeTeX to Rust and kept it running between edits, so a keystroke re-typesets only what changed and LaTeX previews update in milliseconds.
date: 2026-11-23
author: Yendric
tags:
    - texyon
    - latex
    - rust
---

Today I am releasing TeXyoN (after tachyon, a hypothetical faster-than-light particle), a TeX engine based on XeTeX, written in Rust, and specifically designed towards fast preview between edits.

## What I'm releasing

- **Source code** at [texyon-org/texyon](https://github.com/texyon-org/texyon)
- **[`@texyon/wasm`](https://www.npmjs.com/package/@texyon/wasm)**, an npm package that runs the engine in a Web Worker behind a small API. This allows the community to easily create their own interactive TeX experiences in the browser (more editors for you to enjoy on reddit! ;))
- **[TeXyoN Live Preview](https://marketplace.visualstudio.com/items?itemName=texyon.texyon)**, a VS Code extension that runs the native engine locally and updates the preview as you type.

The write-up is quite long, so feel free to skip to the sections that interest you the most. Let's first go back to how we got here.

It is April 2024, and I am working on a beamer slideset for a presentation on how Spectre works. This slideset contains many TikZ diagrams showing memory layouts, and I wanted to be able to immediately see the results of my changes. I looked online and quickly stumbled on [TeXpresso](https://github.com/let-def/texpresso), a very interesting project that uses process forking to snapshot engine state and quickly resume from right before your change. At the time it was quite buggy, and it didn't work on Windows or in the browser. That's when I decided to start my own project. TeXpresso is also how I discovered [Tectonic](https://github.com/tectonic-typesetting/tectonic), which immediately struck my attention for its self-contained nature. TeXyoN is based on Tectonic and its XeTeX engine because of this (though in hindsight, LuaTeX might have been a better choice as it is the more 'modern' engine already).

<TexyonDemo source="\documentclass{article}
\usepackage[paperwidth=10cm,paperheight=10cm,margin=1cm]{geometry}
\usepackage{tikz}
\pagestyle{empty}
\begin{document}
\section*{Quadratics}
The roots of $ax^2 + bx + c$ are
\[ x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}. \]
\begin{center}
\begin{tikzpicture}[scale=0.7]
  \draw[->] (-2,0) -- (2,0) node[right] {$x$};
  \draw[->] (0,-1.3) -- (0,3) node[above] {$y$};
  \draw[thick,blue] plot[domain=-1.8:1.8,smooth] (\x,{\x*\x-1});
  \fill[red] (-1,0) circle (2pt) (1,0) circle (2pt);
\end{tikzpicture}
\end{center}
\end{document}" />

## Making LaTeX preview in realtime

### Why (La)TeX can't compile incrementally

You might be wondering why a full incremental TeX engine does not exist. The main reason is that it is simply not possible. In a real incremental compiler the source is parsed into a structure, and dependencies are tracked between the parsed pieces. As a result, only the pieces that depend on a changed input piece need to be recomputed.

Typst, a well known competitor to LaTeX, was designed from the ground up with this in mind. Functions are pure, and content is immutable. Typst can easily cache the results of pure function calls, and only needs to recompute exactly what changed. This means an edit can reuse everything (every function call) whose inputs did not change.

In TeX, this is not possible. First, TeX cannot even be parsed without running it. It has a category code system, which decides how characters are interpreted and can be changed at runtime. The meaning of a character can change depending on what has been executed before (that's not pure). It's also very difficult to track dependencies, as any macro can be redefined at any time, and global state is used everywhere.

That means we need a different way to make LaTeX preview fast. Making the engine so fast it can recompile everything fast enough would be one way, but unfortunately that's not really realistic. We need to use the same idea incremental compilation uses: try to avoid doing as much work that you've already done as possible. Incremental compilation is not the only way to do that.

### Snapshotting the engine state

The good news is that a TeX pass is completely linear and deterministic. A change later in a document cannot affect the output of an earlier part (except references, see [Getting references to work](#getting-references-to-work)). This paves the way for an incremental snapshotting mechanism, where engine state is saved at certain points in the document. When a change is made, the engine can rollback to the closest snapshot from before the change and continue from there. This is the core idea behind TeXyoN.

Another important insight is that a user can only view a small part of the document at a time. This means that we can focus on showing exactly the parts that are visible to the user quickly, while the rest can follow at a later time (e.g. when the user stops typing or scrolls down).

The difficult part is tracking dependencies (knowing which snapshots are invalid after a change), knowing what engine store to state, and most importantly doing so efficiently. We do not want to just save the entire state at every snapshot, this would be too slow and use way too much memory (which is a problem in a webbrowser, where TeXyoN can run). In the next sections I will be describing how TeXyoN solves these problems, and how it is able to re-typeset what changed in milliseconds.

### The Snapshot ladder

The snapshotting system can be seen as a ladder where snapshots are represented by rungs. Rungs are only taken between two commands of the main engine loop, making restoring easy. The first snapshot rung is taken after the first `32 KiB` of source, and then every `256 KiB` or `500,000` tokens (whichever comes first). The snapshotting algorithm also tries to take snapshots close to recent edits, as you are likely to type there again.

When a user edit happens, the engine needs to figure out what the last valid rung from before the edit is. To do this, each rung remembers the furthest byte the engine had read for each source file. If an edit happens at or before that byte, the rung is invalidated, and files that were read to the end are invalidated by any change (incl. append). TeX files we don't have edit data on are compared by byte and invalidate the rung if they change.

As discussed, it doesn't make sense to compile the document to end for every keystroke. Instead, we just stop after the pages reported visible by the viewport in a **Horizoned** state. The horizon rung marks the point the engine needs to resume from to process the final pages of the document. The client application (vscode extension, wasm library...) can then request to continue processing the rest of the document. Such a continuation can be cancelled if a new keystroke happens (in wasm using chunked continuations, in native using a cancellation flag checked in the main loop).

<LadderReplay />

### Rendering the change

The engine writes XDV (just like XeTeX), and after a replay only the pages from the rung onwards are emitted. These get spliced onto the previous XDV at the byte offset the rung recorded. What's needed now is a way to draw this XDV on the screen. While we could use `xdvipdfmx` to convert the XDV to PDF and render that, this would not be very performant (it's what I did in my [initial attempt](#my-first-attempt-at-snapshotting)). Instead, TeXyoN walks the XDV, starting from the first page whose bytes changed. It then forms a draw plan for each page (which includes glyphs, rules, TikZ paths from `pdf:code` specials, images, links...). These plans are hashed, and only pages whose hash changed and are near the viewport then get drawn. Currently MuPDF is used as the drawing backend, which rasterizes the draw plan at the screen's scale. Finally, the client is only sent the rectangle of pixels that changed since the last draw. Thanks to all of this, rendering XDV takes a few milliseconds, and TeX time is all there is left to worry about.

Note that it is entirely possible that some edge cases are not drawn correctly yet by this fast preview rendering mechanism, so please report any issues you find. Full compiles using TeXyoN still go through `xdvipdfmx` and output has been validated on [over 9,000 documents](#will-my-documents-come-out-the-same).

Here's how long a keystroke takes until the visible page is redrawn (median of 30 to 40 edits):

<Chart title="Keystroke to redrawn page" series={["TeXyoN"]} unit="ms"
setup="Intel i9-12900K, 32 GB RAM, Ubuntu 24.04 on WSL2"
rows={[
["arxiv-1804.07721 (29 pages)", 8.77],
["xetex-reference (28 pages)", 9.02],
["arxiv-1302.6202 (51 pages)", 11.92],
["arxiv-2012.12757 (239 pages)", 13.8],
["article-800 (408 pages)", 14.35],
["spectre (16 pages)", 17.95],
["arxiv-1810.00868 (43 pages)", 21.21]
]} />

A keystroke takes between 9 and 21 ms. The 408 page article is even faster than my 16 page spectre slides, because the slides are full of TikZ.

The browser runs the same engine compiled to WebAssembly, which is 1.2 to 1.5 times slower but still redraws within about 22 ms.

<Chart title="Keystroke to redrawn page, native vs wasm" series={["Native", "Wasm"]} unit="ms"
setup="Intel i9-12900K, 32 GB RAM, Ubuntu 24.04 on WSL2"
rows={[
["article-20", 6.45, 8.55],
["article-200", 10.04, 12.86],
["arxiv-1804.07721", 9.12, 11.23],
["arxiv-2012.12757", 13.45, 20.76],
["spectre", 17.63, 21.74]
]} />

### Storing rungs efficiently

Of course storing the entire engine state for each snapshot would take up far too much memory, especially in the browser. Instead, TeXyoN uses an undo-log to store deltas between rungs. This means most engine-state data structures are journaled in some way or another. A lot of the engine state goes through the `mem` arena, which makes journaling for the vast majority of engine state very cheap. We simply have a bitmap with a bit for each word in the memory arena that marks it as dirty, and the old value is only stored the first time it is modified. Some small structs or arrays are just copied, as it doesn't make sense to journal them.

When an edit happens, we simply start from the current state and apply the undo-log until we reach the desired rung, starting by undoing the changes since the last rung. This is incredibly fast and memory efficient, as deltas between two rungs are usually quite small. This was one of the areas where the [Rust rewrite](#oxidizing-tex) really paid off, as all engine state clearly lives in visible sub-states, rather than scattered global variables.

<LadderDeltas />

Of course we can't endlessly keep creating rungs, as that would make memory grow indefinitely. Therefore, TeXyoN has soft (`64 MiB` on native) and hard budget (`96 MiB` on native), which when exceeded drops the rung whose removal leaves the smallest gap, weighted toward older rungs. It does this by merging its undo delta into the next rung. The budgets are subject to change in future versions, as I haven't really fine tuned them yet.

Some rungs don't make sense to drop, and are labeled as protected. This includes rung 0, the horizon rung and the cluster of rungs before your last edit. Above the hard budget, all protections are ignored and only rung 0 and the newest rung stay.

<LadderBudget />

### Autocomplete from the live engine

Because the engine stays alive between edits, the client can also ask it what is defined. After a compile, TeXyoN lists every command the document can use at that point, with its number of arguments and whether the first one is optional. Autocomplete then knows every command your packages and your own `\newcommand`s define. You can easily request this in `@texyon/wasm` using `engine.commands()`. The VS Code extension does not support this yet.

## Oxidizing TeX

### My first attempt at snapshotting

I originally built TeXyoN (which I then called FlashTeX among my friends) on the C XeTeX engine found in Tectonic. I specifically did not want to go with fork-based snapshotting like TeXpresso as that wouldn't work in Windows or in the browser.

I therefore created a small snapshotting module in C that stored and restored engine `.fmt` dumps in memory (with some modification to make dumps work with freetype fonts). This worked surprisingly well, even in the browser. Rendering still happened using dvipdfmx pointed at the relevant pages, with `mupdf.js` drawing to the browser screen. The main problem with this approach is that 1) it used a lot of memory and 2) it is was very difficult to properly track which state the snapshots needed to save if I wanted to do more fine-grained snapshotting.

### Rewriting it in rust

What I needed was a cleaner codebase, where not everything lives in global variables that are scattered around, and preferably with better typing so obvious mistakes can be caught at compile time. AI coding capabilities were (and are!) on the rise, and I got the crazy idea to do a full rust rewrite of XeTeX. It started with 'dumb' models from the time (by todays standards), and I worked function per function, linking the new Rust code into the rest of the C codebase. This way I could [test for correctness](#will-my-documents-come-out-the-same) after each change. This worked, and after some time I had a fully working XeTeX engine in Rust.

But that was the easy part, because really this was still C code in disguise. There was unsafe everywhere, C datastructures, still global state that lived in C, hacks to get around the borrow checker, and so on. That's where the cleanup part started, which is still very much a work in progress. When I look at the engine codebase today, I still do not think it is clean, but it has come a _very long_ way from the original Web2C codebase it started from. In this section I will be discussing the most important design decisions I made in the cleanup process.

### State

In the original XeTeX codebase, engine state was scattered all over the place as global variables. One of the main goals of the rust rewrite was to make this state more visible and easier to reason about. TeXyoN therefore has an `EngineState` struct that splits into many sub-states. A function only takes the substate it needs.

Many of the global variables where used as hidden return values, because Pascal (and by extension Knuth's Web) did not allow having multiple or non-scalar return values. These have been replaced with proper return values. Doing this also caught many subtle stale-state bugs in the original code, which I am reporting upstream to XeTeX. You can find them in the repository, including a small reproduction for each.

Even though state is much much much cleaner than it was when we started, there is still room for improvement, as many parts still have state stored in the state structs that really should be passed as arguments.

### Memory layout

TeX is mainly built around a big array of words, called `mem`. This array is split into several parts: one part for variably-sized nodes (which uses Knuth's [rover allocator](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)), and fixed-sized parts, including tokenlists. Every node (a box, glue, a token...) is an index into it. Macros then read and write fields at fixed offsets (e.g. `link(p)`, `info(p)`), allowing you to treat a node as a struct. Most of these macros were lost in the C translation I started from, so a lot of code looked like `mem[p + 3].b32.s1 = mem[q + 2].b32.s1;` instead. Ugly.

TeXyoN still has a global `mem` arena for variably-sized nodes, but deals with it in a typesafe way (see below). The main reason for keeping it is that all pointer logic from the original algorithms can be preserved. Together with the fact that most function names are copied directly from the original code, this makes comparing the original code and Rust code for bug fixes and backports very easy. Another big advantage is that all writes go through the same function, which makes journaling very easy. Some fixed sized nodes get their own typed storages, tokens live in a `TokenStore`, glue specs in a `GlueStore` and so on.

Tokenlists specifically are no longer stored as linked lists, which is faster is many cases (cache locality when reading). I'm still doing experiments on this, so expect another blog post soon.

<MemoryMap end="mem_top" blocks={[
{"at": "0", "grow": 1.5, "name": "Glue specs", "text": "zero_glue, fil_glue, ..."},
{"at": "20", "grow": 2.6, "color": "blue", "name": "Variable-size nodes", "text": "Boxes, glue, kerns, native words, ..."},
{"at": "lo_mem_max + 1", "grow": 2.6, "kind": "free", "text": "Unused"},
{"at": "hi_mem_min", "grow": 2.6, "color": "aqua", "name": "One-word nodes", "text": "Token lists and TFM characters"},
{"at": "mem_top − 14", "grow": 1.9, "name": "List heads", "text": "contrib_head, page_head, ..."}
]}>
TeX's original mem layout
</MemoryMap>

Next to `mem` there is also the `eqtb` or equivalence table. This stores what each control sequence means, the value of registers, the parameters (e.g. `\parindent`) and the character codes. It is split into regions, where each region holds a different kind of data. Names live in a separate hash table, which points to the relevant `eqtb` entry. Since XeTeX is unicode, it stores a character code for every code point, which makes `eqtb` very large.

<MemoryMap end="eqtb_top" blocks={[
{"at": "active_base", "grow": 1.8, "color": "blue", "name": "Active and one-character control sequences"},
{"at": "hash_base", "grow": 1.3, "color": "violet", "name": "Hash table"},
{"at": "glue_base", "grow": 1, "color": "aqua", "name": "Glue"},
{"at": "local_base", "grow": 1.5, "color": "orange", "name": "Token lists, boxes, fonts and codes"},
{"at": "int_base", "grow": 1, "color": "yellow", "name": "Integers"},
{"at": "dimen_base", "grow": 1.3, "color": "magenta", "name": "Dimensions"},
{"at": "eqtb_size + 1", "grow": 1.7, "name": "Hash overflow"}
]} />

In TeXyoN, `eqtb` is split into a typed table for each kind: meanings, ints, dimens, catcodes... Each table journals its values, so they can correctly rollback. Big arrays are also not pre-allocated, but grow on demand, which makes TeXyoN a little more memory efficient than XeTeX:

<Chart title="Peak memory" series={["TeXyoN", "XeTeX"]} unit="MiB"
setup="Intel i9-12900K, 32 GB RAM, Ubuntu 24.04 on WSL2"
rows={[
["arxiv-2012.12757", 144, 191],
["lshort", 178, 228],
["xetex-reference", 191, 215],
["plots", 137, 192]
]} />

### Typed nodes using `NodePtr<K>`

To make the memory arena work in Rust, while keeping call sites clean and close to the original code, I created a `NodePtr<K>` type. The memory arena allows indexing by such a pointer, and the compiler then knows which fields `K` has. This allows for type safety (including in function arguments) and makes the code a lot more readable.

To achieve this, each node kind is a `#[repr(C)]` struct and is read with `bytemuck`. The latter overlays the struct over the `Vec<u32>` that backs the memory arena, and the user just gets a `&BoxNode` or similar back (depending on `K`). The underlying `MemIdx` used by `NodePtr<K>` is a `NonZeroU32`, which allows for nullable pointers to be `Option<NodePtr<K>>` without increasing the size of the pointer. On top of the typed pointers, many raw integer values were replaced with newtypes, like `Scaled`, `FontId` and so on, so they can't be confused with eachother.

I do realize that this is not all idiomatic Rust, but it is an approach that keeps call sites clean and readable, and allows keeping the many cross referencing pointers TeX uses in its core algorithms.

Below you can see the before and after of `make_vcenter`, which centers a `\vcenter` box on the math axis by splitting its total height evenly around it. Tectonic's C:

```c
delta = mem[v + 3].b32.s1 + mem[v + 2].b32.s1;
mem[v + 3].b32.s1 = axis_height(cur_size) + half(delta);
mem[v + 2].b32.s1 = delta - mem[v + 3].b32.s1;
```

TeXyoN:

```rust
// v: NodePtr<BoxNode>
let delta = mem[v].height + mem[v].depth;
let node = &mut mem[v];
node.height = axis_height + delta.half();
node.depth = delta - node.height;
```

This typing of the nodes also helped find some bugs in upstream XeTeX, that long went unnoticed.

### Can we go faster?

Even without any tricks, TeXyoN compiles faster than TeX Live's XeTeX. Times below are the median of 5 runs, and with the native `pgfmath` described below turned off.

<Chart title="Compile time to XDV" series={["TeXyoN", "XeTeX"]} unit="s"
setup="Intel i9-12900K, 32 GB RAM, Ubuntu 24.04 on WSL2"
rows={[
["arxiv-1804.07721", 0.253, 0.399],
["arxiv-1810.00868", 0.472, 0.67],
["arxiv-1302.6202", 0.358, 0.592],
["arxiv-2012.12757", 1.006, 1.683],
["lshort", 2.399, 3.195],
["xetex-reference", 0.879, 1.018],
["spectre (beamer + TikZ)", 0.853, 0.962],
["plots (pgfplots)", 2.646, 3.241]
]} />

As you can see, TeXyoN is faster in all cases for full compiles (to XDV), even though we currently mostly focus on edit performance. But we can go even faster. TeX misses many useful low-level primitives, like ones for working with floating point numbers. Packages work around this by building them with macros. `pgfmath`, which is used by `tikz` and `pgfplots`, is a good example of this. It parses and evaluates every expression one token at a time using TeX macro expansion. Plots and diagrams evaluate thousands of expressions, so this adds up quickly.

Since we own the engine, we can cheat a little by implementing these math macros natively. In fact, `pgfmath` already has a lua implementation of its math engine for `LuaTeX`. Every time pgf calls `\pgfmathparse@trynumber@loop`, TeXyoN takes over and evaluates the expression using native f64 math (which is sometimes a little more accurate, leading to small differences). We then define `\pgfmathresult` and continue at `\pgfmath@parse@end`.

This hook costs nearly nothing when it is not used, as it only requires a single comparison for each macro call. The performance gain can be significant, as shown in the benchmarks below. The `pgfplots` document has its compile down halved using this mechanism. My spectre slides give a smaller gain (about 10%) on total compile times (the document is quite small, so tikz & pgfmath are only a small part), though live preview edits in TikZ-heavy documents get about 50% faster.

<Chart title="Compile time, pgfmath native vs macros" series={["Native", "Macros"]} unit="s"
setup="Intel i9-12900K, 32 GB RAM, Ubuntu 24.04 on WSL2"
rows={[
["plots", 1.368, 2.724],
["spectre", 0.781, 0.861]
]} />

This hook is opt-in for full compiles and meant as a fun performance experiment. I'm actively exploring other ways to speed up (La)TeX. For example, LaTeX has many occasions where it checks for optimized versions of certain operations (usually meant for using the lua version), where we could easily hook in a native Rust implementation. I'm also looking into pure code optimizations, for example improving memory locality, but also many other ideas I will be writing about in future posts.

### Getting references to work

As you may know, (La)TeX computes references in multiple passes. The first time it compiles the document, it writes away reference definitions to an `.aux` file. Then, on the next compile, it reads this `.aux` file near the top of the document, and uses that state to fill in the (?) references. This makes referring to the future possible. Table of contents, cross-references, and citations all work this way.

Obviously, this is a problem for our resident engine that continues from the closest snapshot. The `.aux` file will never be re-read, as the macros at the start of the document will not be re-executed (unless you do an edit in the preamble).

Luckily, there's a relatively clean way to get references to work in TeXyoN, without compromising on user experience. The idea is to have two concurrent executions of the engine, where one deals with quick updates near the cursor, while the other recompiles the document from the point where the `.aux` file is read. The good news is we do not need separate processes or threads for this (which is esp. useful for WASM). We can modify our snapshotting mechanism as follows (at a high level):

- When the user doesn't type for a short amount of time, we rollback to the state where the `.aux` file is read. This uses the undo-log we already have, and behaves exactly like an edit happening at that location. We'll call this location the common ancestor, which will be used as a pivot point between the two concurrent executions.
- Instead of only rolling back, we build a redo-log while rolling back. This means if the user types again, we can very quickly roll forward starting from the common ancestor, and quickly compile the viewable changes near the cursor (as we normally would). We then rollback again to where we were and continue with the full compile.
- The full 'background' compile has a separate undo-log that it uses to keep track of its own changes. This way the full compile can quickly rollback to the common ancestor as well. While rolling back, it keeps a redo-log of its own such that it can quickly resume where it left off.
- If the user edits a part of the document that the background compile has already passed, we simply truncate the background compile's redo-log at that edit point so it doesn't resume with stale state. Once the background compile catches up to the user's viewport (or finishes the document), we promote its undo-log to become the new main history and discard the old one.

I have not yet implemented this, but will be doing so soon.

### Limitations

TeXyoN is XeTeX only, so packages that need LuaTeX or pdfTeX primitives won't work, and shell escape is disabled (no minted). In the live preview, references stay stale until a full pass, and an edit in the preamble re-typesets the whole document.

## Q&A

### Will my documents come out the same?

It is of course important that a TeX engine produces the output you expect. That's why TeXyoN has an upstream comparison harness that compiles the same documents with TeXyoN and XeTeX. It includes over 9,000 documents: LaTeX's own regression tests, the documentation of every package in TeX Live, and around 1,400 papers from arXiv.

For every document it compares the log and the XDV output, and then renders both to pixels to compare what you actually see. Not all documents are succesfull compiles (TeX Live docs has some documents that don't compile: LuaTex specific, outdated...), for those documents, TeXyoN is required to fail in exactly the same way as XeTeX. Most documents come out completely identical, but some differ because of upstream bugs that have been fixed in TeXyoN but not in XeTex. Some others fail because TeXyoN calculates font metrics with floating point numbers, which is more accurate but can shift something by the smallest unit TeX knows (about 5 nanometers).

On top of that, all new tests in TeXyoN are checked with mutation testing. This means I deliberately break the code it covers and check that the test actually fails.

### My paper is 400 pages, will it still be fast?

That's one of the questions I got on my [original post](https://www.reddit.com/r/LaTeX/s/GVQqCrPvqP), and the answer is a resounding yes! The core snapshotting mechanism's time complexity only scales with the number of pages that are visible in the viewport, the complexity of them, and the distance from the nearest rung. It does not matter how many pages are in the document, as clearly depicted in the benchmark below. The rollback time of the undo-log is pretty much negligible. The only thing that will be slow is a full compile (TeXyoN does not speed that up significantly).

(note: in my original post, the demo I published still had some rendering and synctex bugs, leading to much degraded performance on large documents)

<Chart type="line" scale="log" title="Keystroke vs full compile" series={["TeXyoN keystroke", "XeTeX compile"]} unit="ms" xUnit="pages"
setup="Intel i9-12900K, 32 GB RAM, Ubuntu 24.04 on WSL2"
rows={[
[11, 6.58, 610],
[52, 9.78, 798],
[102, 10.21, 1136],
[205, 14.35, 1869],
[408, 14.35, 3095]
]} />

## Conclusion

TeXyoN keeps XeTeX running between edits and rewinds to the closest snapshot before your change, so a keystroke costs milliseconds, even in long documents. You can try it today in [VS Code](https://marketplace.visualstudio.com/items?itemName=texyon.texyon), build your own editor on top of [`@texyon/wasm`](https://www.npmjs.com/package/@texyon/wasm), or read the [source](https://github.com/texyon-org/texyon). If a document renders differently from what you expect, please open an issue.

I'm planning on actively maintaining TeXyoN, and will be keeping it up to date with the latest TeX Live releases. I have already done so up until TeX Live 2026. This is relatively straightforward since function names are mostly the same. The project we forked from, Tectonic, has not done so yet. Unfortunately, as the codebase has been entirely rewritten, these changes cannot easily be recontributed back to Tectonic. Since TeXyoN is based on XeTeX, and XeTeX is in maintenance mode, there shouldn't be too many features to keep up with, which makes maintaining the project easier.

This does mean TeXyoN might miss out on some new features, like tagged PDFs. I'm considering adding some of these features myself, but this should not (yet) be taken as a guarantee. The main goal of TeXyoN is to provide a clean Rust implementation of TeX with live preview, and to experiment with many performance optimizations. The project is open source, so ideas and contributions are more than welcome!

Next I'm working on [references in the live preview](#getting-references-to-work), and on more speedups I'll write about later.
