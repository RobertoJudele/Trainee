# Licenta FMI - Pachet LaTeX

Acest director contine varianta de lucru pentru lucrarea de licenta pe tema Trainee, redactata in LaTeX si gandita sa se potriveasca fluxului FMI (ghid + template oficial pentru finalizarea studiilor).

## Ce gasesti in folder

- `main.tex` - fisierul principal al documentului
- `frontmatter/` - coperta, rezumat, abstract
- `chapters/` - capitolele lucrarii
- `appendix/` - anexe tehnice
- `references.bib` - bibliografie in stil APA

## Cum compilezi in Overleaf

1. Creezi un proiect nou.
2. Uploadezi continutul din `docs/licenta-fmi`.
3. Folosesti compilator `pdfLaTeX` (sau `XeLaTeX` daca vrei ajustari de font).
4. Rulezi compilarea de mai multe ori pentru a genera corect cuprinsul, listele si bibliografia.

## Cum compilezi local (MiKTeX / TeX Live)

Comenzi recomandate:

```bash
pdflatex main.tex
biber main
pdflatex main.tex
pdflatex main.tex
```

## Observatie

Documentul este structurat ca baza de redactare completa. Daca extinzi fiecare capitol cu exemple, diagrame si discutii metodologice, tinta de aproximativ 50 de pagini este realist de atins fara sa fortezi textul.
