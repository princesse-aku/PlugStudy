# Déploiement de PlugStudy

Le **backend** (FastAPI) va sur **Render**, le **frontend** (Next.js) sur **Vercel**. Les clés ne sont jamais dans Git :
elles se saisissent dans les tableaux de bord de Render et de Vercel.

## En ligne (déployé le 25 novembre 2026)

| | Adresse |
| --- | --- |
| Site (Vercel, projet `plug-study` (domaine `plugstudy.vercel.app`)) | https://plugstudy.vercel.app |
| API (Render, service `plugstudy-api`, Francfurt, plan gratuit) | https://plugstudy-api.onrender.com (`/health`) |

- Vercel redéploie le site à chaque `git push` sur `main`.
- Render ne redéploie pas tout seul (dépôt public non connecté à un compte GitHub) : *Manual Deploy* dans le tableau de bord après un changement du backend.
- `ALLOWED_ORIGINS` (Render) = `https://plugstudy.vercel.app,http://localhost:3000`. Domaine `plugstudy.vercel.app` ajouté dans Firebase > Authentication > Domaines autorisés.
- Variables du frontend (Vercel > Settings > Environment Variables) : les 6 `NEXT_PUBLIC_FIREBASE_…` et `NEXT_PUBLIC_API_URL`.

## Ordre à suivre

1. **Render** : créer le backend, récupérer son adresse (`https://….onrender.com`).
2. **Vercel** : créer le frontend avec cette adresse dans `NEXT_PUBLIC_API_URL`, récupérer son adresse (`https://….vercel.app`).
3. **Render** : mettre l'adresse Vercel dans `ALLOWED_ORIGINS` (sinon le navigateur bloque les appels : CORS).
4. **Firebase** : ajouter l'adresse Vercel dans Authentication > Paramètres > Domaines autorisés.

## 1. Backend sur Render

- *New > Blueprint*, choisir le dépôt `PlugStudy` (le fichier `render.yaml` décrit le service : dossier `backend`, région Francfurt, plan gratuit).
- Variables à saisir (celles marquées secrètes dans `render.yaml`) :

| Variable | Valeur |
| --- | --- |
| `FIREBASE_CREDENTIALS_JSON` | contenu JSON du compte de service Firebase, sur une seule ligne (secret) |
| `RODIUMAI_BASE_URL` | `https://api.rodiumai.io/v1` |
| `RODIUMAI_API_KEY` | la clé RodiumAI (secret) |
| `ALLOWED_ORIGINS` | l'adresse Vercel (étape 3 ; au début, `http://localhost:3000`) |

- Les autres valeurs (modèle `google/gemini-3.8-flash`, embeddings désactivés…) sont déjà dans `render.yaml`.
- Vérifier : `https://….onrender.com/health` doit répondre `{"status":"ok"}`.

## 2. Frontend sur Vercel

- *Add New > Project*, choisir le dépôt `PlugStudy`, et **Root Directory = `frontend`** (Next.js est détecté tout seul).
- Variables d'environnement (publiques, intégrées au site au moment du build) :

| Variable | Valeur |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_STORAGE_BUCKET`, `…_MESSAGING_SENDER_ID`, `…_APP_ID` | la configuration de l'application web Firebase (même valeurs que `frontend/.env.local`) |
| `NEXT_PUBLIC_API_URL` | l'adresse Render, sans `/` à la fin |

- Toute modification d'une variable `NEXT_PUBLIC_…` demande un **nouveau déploiement** (*Deployments > Redeploy*).

## Vérifier en ligne

1. Ouvrir l'adresse Vercel, créer un compte, ouvrir le lien reçu par e-mail, remplir l'onboarding.
2. Ajouter un cours (PDF avec du texte) : l'écran « On prépare ton cours » avance, puis fiche, notions et quiz apparaissent.

## Limites du plan gratuit de Render

Le service s'endort après 15 minutes sans visite : le premier envoi de cours après une pause peut prendre 30 à 60 secondes à
démarrer, et une préparation en cours peut être interrompue si le service s'arrête. Pour de vrais étudiants, passer au plan
`starter` (changer `plan: free` en `plan: starter` dans `render.yaml`).
