# PlugStudy

Application web mobile qui lit les cours d'un étudiant et lui dit quoi réviser en premier.

PlugStudy est un projet d'équipe du bootcamp RodiumAi (équipe 5, J-PLUG), pour les étudiants du Bénin et du Togo.

**MVP** : création de compte avec vérification par lien, connexion (e-mail, Google), onboarding, profil modifiable, puis
ajout d'un cours que l'IA lit pour dégager les notions, les classer de la plus à la moins importante, et préparer la fiche,
la séance de révision et le quiz. L'assistant (chatbot), le suivi et le planning sont construits ou prévus mais cachés
(réglages dans `frontend/src/lib/features.ts`).

## Organisation

```
frontend/          application Next.js (pages, composants, tests, configuration)
backend/           API Python / FastAPI (traitement des cours, assistant) : voir backend/README.md
firestore.rules    règles de sécurité Firestore
render.yaml        déploiement du backend sur Render
```

## Démarrer le frontend

Node.js 18.17 ou plus récent est nécessaire.

```
cd frontend
npm install
npm run dev
```

Ouvre http://localhost:3000. Sans configuration Firebase, l'application tourne en **mode démo** : la connexion est
simulée et les données restent dans le navigateur. Pour utiliser Firebase, copie `frontend/.env.example` vers
`frontend/.env.local` et remplis les valeurs.

## Démarrer le backend

Python 3.12 ou plus récent. Les étapes sont dans [backend/README.md](./backend/README.md). Sans backend
(`NEXT_PUBLIC_API_URL` vide dans `frontend/.env.local`), les cours ajoutés restent en « préparation ».

## Structure du frontend

```
frontend/src/app/           pages (une par écran du design)
frontend/src/components/    composants d'interface (boutons, champs, cadre d'écran, barre du bas)
frontend/src/lib/           authentification, données, règles de calcul, couche Firebase et mode démo
frontend/tests/             tests du frontend
frontend/public/            icônes, logo, service worker (PWA)
```
