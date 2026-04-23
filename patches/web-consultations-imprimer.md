# Patch F-P0-1 + F-P1-6 — XSS `handleImprimer` dans `pages/consultations/nouvelle.tsx`

## Contexte

Ligne ~825 du fichier actuel — la fonction `handleImprimer` construit du HTML
par interpolation directe de valeurs utilisateur (`nomAnimal`, `espece`,
`nomProprietaire`, `resume`) et l'injecte via `document.write`. C'est une
**XSS persistante** exploitable par n'importe qui pouvant créer un owner ou
patient avec un nom contenant du HTML.

## Patch

Remplacer le bloc :

```ts
const handleImprimer = () => {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html>...${nomAnimal}...${resume.replace(/\n/g, "<br>")}...`);
  w.document.close();
  w.focus();
  w.print();
};
```

Par :

```ts
const handleImprimer = () => {
  // F-P1-6 : noopener + noreferrer pour couper le tab-nabbing.
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    toast({
      title: "Ouverture de la fenêtre d'impression bloquée",
      description: "Autorise les popups pour ce site et réessaie.",
      variant: "destructive",
    });
    return;
  }

  // F-P0-1 : on construit le DOM avec textContent (pas d'interpolation HTML).
  const doc = w.document;
  doc.title = `Résumé consultation — ${nomAnimal ?? "Patient"}`;

  const style = doc.createElement("style");
  style.textContent = `
    body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;line-height:1.7;color:#222}
    h1{font-size:22px;margin-bottom:4px}
    p{white-space:pre-wrap}
    @media print{button{display:none}}
  `;
  doc.head.appendChild(style);

  const body = doc.body;

  const h1 = doc.createElement("h1");
  h1.textContent = "Résumé de consultation";
  body.appendChild(h1);

  if (nomAnimal) {
    const p = doc.createElement("p");
    const strong = doc.createElement("strong");
    strong.textContent = "Patient : ";
    p.appendChild(strong);
    p.appendChild(
      doc.createTextNode(`${nomAnimal}${espece ? ` (${espece})` : ""}`),
    );
    body.appendChild(p);
  }

  if (nomProprietaire) {
    const p = doc.createElement("p");
    const strong = doc.createElement("strong");
    strong.textContent = "Propriétaire : ";
    p.appendChild(strong);
    p.appendChild(doc.createTextNode(nomProprietaire));
    body.appendChild(p);
  }

  body.appendChild(doc.createElement("hr"));

  // Resume peut contenir des newlines — on utilise white-space:pre-wrap (déjà
  // setté dans le <style> ci-dessus) et textContent pour un rendu propre
  // sans aucune interprétation HTML.
  const pResume = doc.createElement("p");
  pResume.textContent = resume;
  body.appendChild(pResume);

  body.appendChild(doc.createElement("hr"));

  const btn = doc.createElement("button");
  btn.textContent = "Imprimer";
  btn.onclick = () => w.print();
  body.appendChild(btn);

  doc.close();
  w.focus();
  w.print();
};
```

## Test smoke

1. Crée un owner avec nom : `<img src=x onerror="alert('XSS')">`
2. Crée une consultation pour son animal.
3. Clique "Imprimer le résumé" → la fenêtre s'ouvre et affiche le texte
   **littéral** `<img src=x onerror="alert('XSS')">` sans exécuter le JS.
4. Vérifier absence d'alert et HTML source propre (F12).
