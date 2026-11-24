# הוראות ל-Claude Code

הדבק את הטקסט שמתחת לקו בסשן חדש של Claude Code, בתיקייה ריקה חדשה שבה שמת את `Plan.md`.

---

You are building a new project from `Plan.md` in this folder. Read the whole file before doing anything.

Rules for this session:

1. This is a new, separate project. Do not open, change or copy code from the math game folder (`YuvalGame`).
2. Work through the tasks in `Plan.md` in order, one task at a time. Follow each task's steps: write the failing tests, run them, implement, run again, commit.
3. `Plan.md` is the source of truth for names, signatures, numbers and Hebrew text. If something in it is unclear or looks wrong, stop and ask me instead of guessing.
4. Before Task 1, run `git init` and tell me the plan of work in a few lines. Wait for my go-ahead before you start.
5. Stop after Task 8 (the checkpoint in the plan) and after each of Tasks 9, 10 and 11. Tell me how to run the app so I can try it, and wait for my go-ahead before the next task.
6. Install only what the plan names: Vite, TypeScript, Vitest. Ask me before adding any other package.
7. Pictures come only from the Noto Emoji repository named in Task 4. Read its LICENSE first and record what you copied in `ASSETS.md`. Do not download or generate any other images, and do not produce audio files.
8. Commit after every task with the message the plan gives. Do not push and do not create a remote repository unless I ask.
9. Do not build anything from Step 2 (accounts, cloud, coupons), even if it seems easy to add.
10. Report to me in Hebrew. Keep code, commands and commit messages in English.

When all 12 tasks are done, give me a short summary: what works, what you could not check yourself (the Android and iOS checks in Task 12 are mine to do), and anything in the plan you had to interpret.
