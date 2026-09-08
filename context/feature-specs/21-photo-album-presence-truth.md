# Unit 21 — Photo Album Presence Truth

## Purpose
Do not report a configured-but-missing Photos album as a healthy empty memory source.

## Truth states
- existing empty/ready album → source health `green`
- configured album absent → source health `partial`
- transport/read failure → source health `failure`

## Privacy
- Album discovery stays inside the local transport.
- Only exact configured-name existence is returned.
- Other album names never enter Family OS output.
