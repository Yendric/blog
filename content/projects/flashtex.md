---
template: project
title: FlashTeX
description: FlashTeX is a live LaTeX preview tool that renders your document as you type.
date: 2026-06-01
author: Yendric
order: 1
tags:
  - LaTeX
---

![Editing LaTeX text and TikZ with live preview](https://i.redd.it/3an4s4ngv4sh1.gif)

FlashTeX is an in-engine checkpointing system for XeTeX that supports realtime previewing of document edits. It features a full Rust rewrite of tectonic's XeTeX code, done by agents. This new engine much more cleanly manages engine state than the original implementation, making the checkpointing mechanism possible. It has been validated for identical output in over 600 documents. FlashTeX can also compile to wasm, allowing it to run entirely in the browser.

It also features many other engine optimizations, such as implementing the math macros TikZ & PGF use directly in the engine.

Read more about it here: [https://www.reddit.com/r/LaTeX/s/GVQqCrPvqP](https://www.reddit.com/r/LaTeX/s/GVQqCrPvqP). Technical write-up, benchmarks and source code coming soon!
