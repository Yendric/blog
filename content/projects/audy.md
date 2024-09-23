---
template: project
title: Audy
description: Audy is a Win32 application that enables you to modify your audio output device using a keyboard shortcut.
date: 2022-03-24
author: Yendric
---

Audy is a Win32 application that enables you to modify your audio output device using a keyboard shortcut. The default shortcut is Shift+Alt+ArrowUp. I mainly wrote this program to learn a bit more about C and the inner workings of the Win32 API.

It ended up being a little more challenging than expected, as my stubborn self really wanted to write this in pure C even though no C API is directly available for changing audio outputs in Windows. Lukily someone had already reverse-engineered (yes, it's somehow that obscure) this to a C++ class header, so all I had to do was translate this to something that is usable in C and hook it up to a keyboard shortcut.

The source code can be found on my Github: <https://github.com/Yendric/audy>
