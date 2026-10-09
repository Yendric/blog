---
template: post
title: Please, close your laptop
description: Working with agents on your laptop can be tedious, as you can't close the lid when it's busy. Moreover, having multiple copies of your project on multiple machines you constantly switch between is annoying. In this post I explain how I dealt with this, by using shpool for persistent remote shell sessions and a small wrapper to allow reattaching when reopening.
date: 2026-10-09
author: Yendric
tags:
  - terminal
  - shpool
  - agents
---


Working with agents on your laptop can be tedious, as you can't close the lid when it's busy. Moreover, having multiple copies of your project on multiple machines you constantly switch between is annoying. In this post I explain how I dealt with this, by using **shpool** for persistent remote shell sessions and a small wrapper to allow **reattaching** when reopening.

## The problem

I work on two machines: a desktop at home and a laptop when I'm away. For a long time, I've had most of my projects stored on both, pushing and pulling to keep them in sync. This works, but comes with some problems, amplified by the usage of AI:
- Agent memory and history don't transfer over
- Uncommitted changes don't transfer
- It gets annoying when you're working with worktrees
- I can't close my laptop

<Figure src="/assets/img/close-laptop.webp" width="1080" height="1128" class="mx-auto max-w-md" alt="Tweet by @cormachayden_: software engineers before vs after agents. Left: a laptop carried closed. Right: the same laptop carried slightly open so it doesn't sleep.">
Via [@cormachayden_](https://x.com/cormachayden_) on X
</Figure>

Now, of course, an obvious solution is to just put all projects on one machine: the desktop, that remains always on. To manage them remotely you can use the **remote-control** features built into your harness, or **SSH**. This works, but doesn't feel good enough to me.

### How I code
I really like my terminal. I do most things from the terminal and also use the Claude Code CLI there to work with agents. I run Windows with **WSL** everywhere, as it gives a nice separation between dev-stuff and regular stuff, with the dev stuff being on WSL. This means I also use **Windows Terminal**, which I like a lot: it is very configurable, has native panes and even is open source. When above I was talking about "my laptop" and "my desktop", I actually meant "my laptop's WSL" and "my desktop's WSL".

So, when I'm working on projects (with or without coding agents) remotely, I would like to keep using my terminal as I'm used to. Now again, I could just set up an SSH profile in Windows Terminal, and have my laptop connect to my desktop that way. The connection can easily be made using something like [Tailscale SSH](https://tailscale.com/kb/1193/tailscale-ssh). Everything works: I have my native terminal like before and can keep using my panes. But those sessions still die when I close my laptop, and I can't easily reattach them when I get home and look at my desktop.

An obvious solution, and a widely used one, is [tmux](https://github.com/tmux/tmux). It gives you panes inside of the terminal, and survives the closed SSH sessions. However, I decided against using it because:
- I would no longer have native panes & tabs in my terminal
- Scrolling doesn't feel right / isn't native

## What I want
The requirements now are clear, I want something that:
- Works in the **terminal**
- Doesn't create its own panes or scrollbar, so it works cleanly in apps like Windows Terminal
- Survives a **killed SSH** session
- Allows me to **reattach** on reopening, also on the desktop
- **BONUS:** Automatically forwards common dev ports (like 8080) to my laptop's localhost, so I can view running projects from my laptop
- **BONUS:** allows me to type ``code .`` in a directory to immediately open vscode, on my laptop, connected to the remote machine in the right directory via SSH

The last one is a very nice one. By allowing me to easily open vscode, I have a visual file browser to view the code, review changes, or even upload files within arm's reach.

On top of all of this, the regular **remote-control** feature built into tools like Claude Code still works and can augment this experience, for example for quick checks from my phone.

## How it's set up
I wanted something minimal, that is stable and always works. First of all, everything is built on top of **SSH**, using Tailscale's built-in SSH ability (and policies) to make connecting from anywhere easy. 

To make the terminal sessions not die on a closed SSH connection, I use [shpool](https://github.com/shell-pool/shpool). Unlike tmux it does not have panes, it's very bare-bones: it holds a shell and lets you reattach. Exactly what I want.

To make reattaching easy, I have a small bash script that runs on connecting. It looks at what sessions are in use and what aren't, and shows an **fzf** picker menu to allow you to pick an existing session to reattach to.

<FileDownload src="/assets/files/pane" lang="bash" />

### The terminal side
On my laptop, I added a profile called "Desktop" to Windows Terminal, which simply runs `ssh pc`. Connecting starts the `pane` script, so a new Desktop tab drops me right into the picker, or straight into a shell if there's nothing to pick up.

Splitting a pane also keeps the directory I'm in. For local panes, my `.zshrc` reports the current directory to Windows Terminal on every prompt, so a duplicated pane opens in the same place. That doesn't work over SSH, because Windows Terminal can't do anything with a Linux path on another machine. So inside shpool sessions, a small hook saves the directory on every `cd`, and the `pane` script starts new sessions there.

On the desktop itself, I have an "Agents" profile that runs `wsl.exe -d Ubuntu --exec ~/.local/bin/pane`, so I get the same picker and the same sessions there.

### Viewing the projects from my laptop

The port forwarding can very easily be achieved using SSH itself, as it has configuration options for this:
```bash
# C:\Users\me\.ssh\config
Host pc
  HostName pc-wsl
  User yendric
  RequestTTY yes
  RemoteCommand ~/.local/bin/pane
  ServerAliveInterval 30
  LocalForward 8080 localhost:8080
  LocalForward 3000 localhost:3000
  LocalForward 5173 localhost:5173
```

### Opening vscode as if it were local

In a normal setup, typing ``code .`` opens vscode in the current directory. I wanted that same experience over SSH: type ``code .`` in a pane on my laptop, and vscode should open **on my laptop**, connected to my desktop over Remote-SSH, in that directory.

Vscode already has a mechanism for this. When you open a terminal inside a Remote-SSH window, it puts its own `code` command on your PATH. That command talks to the vscode server on the remote machine over a socket (`VSCODE_IPC_HOOK_CLI`), and the server tells the window on your laptop to open the folder. 

So I wrote a small `code` wrapper in `~/.local/bin`, which comes before the real one on my PATH. When I run it, it:
1. Checks which machine the pane is showing on. On the desktop it just runs the regular Windows `code`, like before.
2. On the laptop, it looks for a vscode server that was started over SSH, by searching the running processes for a `VSCODE_IPC_HOOK_CLI` socket next to an `SSH_CONNECTION`, and opens the directory in it.
3. If no vscode window is connected yet, it prints a clickable `vscode://vscode-remote/ssh-remote+pc-wsl/...` link instead, allowing me to connect straight to that folder.

<FileDownload src="/assets/files/code" lang="zsh" />

## Living with it
<Figure src="/assets/video/pane-demo.mp4" poster="/assets/video/pane-demo.jpg" width="1920" height="1058">
Opening, splitting and reattaching sessions.
</Figure>

I'm very happy with what I've built, it works exactly how I want it to. I can open a Desktop tab on my laptop, get a shell, split it, reattach to panes that were doing something and open vscode when I need a visual file browser. The picker only shows up when there's actually something to pick up: a session that's running something and is either disconnected or open on the other machine. Other sessions get cleaned up automatically.

When my laptop sleeps or the Wi-Fi drops, the pane shows "press Enter to restart". The agent on my desktop doesn't notice a thing. Picking a session that's open on the other machine takes it over, so I can walk up to my desk and continue exactly where I was.

It's also very clean: two scripts, a shpool config and two terminal profiles, and I can finally close my laptop.
