# PlugStudy : backend (FastAPI)

Il lit les cours des étudiants et prépare ce que le frontend affiche : la fiche résumée, les notions classées, le quiz,
et les réponses de l'assistant. Les clés d'API restent ici, jamais dans le frontend.

## Ce qu'il fait

| Route | Rôle |
| --- | --- |
| `POST /courses/{id}/process` | Reçoit le fichier d'un cours (PDF, DOCX, PPTX, TXT ; 20 Mo au plus) et répond `202`. La préparation continue en arrière-plan. |
| `POST /courses/{id}/assistant` | `{ "question": "…" }` → `{ "text", "source" }` : réponse tirée **uniquement** des passages du cours. |
| `GET /health` | Vérification de santé (Render). |

Toutes les routes de cours demandent le jeton Firebase de l'étudiant (`Authorization: Bearer …`). Le backend écrit dans
Firestore avec le SDK Admin, uniquement sous `users/{uid}` de l'étudiant identifié par son jeton.

### Préparation d'un cours (`app/pipeline.py`)

Le document `users/{uid}/courses/{id}` est mis à jour à chaque étape (`prepStep`), ce qui alimente l'écran « On prépare ton cours » :

1. **Lecture du fichier** (`prepStep` 1) : extraction du texte (`app/extract.py`). Pas assez de texte (PDF scanné, photo) → `status: "error"`, `errorReason: "unreadable"`.
2. **Fiche résumée** (2) : résumé (`summary`) et notions (`notions/{n01…}`).
3. **Quiz** (3) : questions (`questions/{q-…}`) et passages du cours avec embeddings (`chunks/{c0001…}`).
4. **Plan de révision** (4) : plan du cours (`outline`), base du futur Planning. `status` passe à `ready`.

Raisons d'échec (`errorReason`) : `format`, `unreadable`, `empty`, `ai`, `failed` (le frontend affiche le message correspondant).

### Règles de calcul (document de fonctionnalités)

- Score d'une notion **S = 0,4·I + 0,3·F + 0,3·P**. **I** (importance) est jugée par l'IA ; **F** (fréquence dans le cours) et **P**
  (position : 1 dans un titre, 0,7 dans une zone d'exercices, 0,3 sinon) sont **calculées ici, sans IA** (`app/analysis.py`).
- Une notion n'est gardée que si son **extrait est retrouvé mot pour mot** dans le cours : sinon elle n'a pas de preuve.
- Chaque notion et chaque réponse porte sa **source** : « Algorithmique, chap. 2, p. 14 » (ou « diapo », « partie » selon le format).
- Le texte du cours est traité comme une donnée : les instructions qu'il contiendrait sont ignorées (`app/generate.py`).
- Le fichier est lu en mémoire puis oublié. Les journaux ne contiennent jamais le contenu d'un cours.

## Lancer en local

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
copy .env.example .env      # puis remplir les valeurs
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Dans le frontend, mettre `NEXT_PUBLIC_API_URL=http://localhost:8000` dans `frontend/.env.local`.

### Tests

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Les tests n'appellent aucun service externe : fausse IA, Firestore en mémoire, et un faux serveur compatible OpenAI
pour vérifier le vrai client.

## Variables d'environnement

Voir `.env.example`. Les indispensables :

- `FIREBASE_PROJECT_ID` et `FIREBASE_CREDENTIALS_JSON` : compte de service Firebase (console Firebase, Paramètres du projet,
  Comptes de service, « Générer une nouvelle clé privée »). Secret : jamais dans Git ni dans le frontend.
- `RODIUMAI_BASE_URL` et `RODIUMAI_API_KEY` : API RodiumAI. Le client suppose une API **compatible OpenAI**
  (`/chat/completions` avec `response_format: json_object`, et `/embeddings`). Si ce n'est pas le cas, seul `app/ai.py` change.
- `RODIUM_MODEL_STRONG` (extraction des notions, quiz) et `RODIUM_MODEL_FAST` (résumés, assistant) : le MVP utilise un seul modèle,
  `google/gemini-3.8-flash`, pour les deux. Si le fournisseur refuse le « mode JSON », le client réessaie sans.
- `RODIUM_EMBEDDINGS_ENABLED` : `false` dans le MVP (les embeddings ne servent qu'à l'assistant, qui est caché).
- `RODIUM_REASONING_BUDGET` (6000) : marge de jetons ajoutée à chaque appel, car ce modèle « à réflexion » dépense des jetons à
  réfléchir avant d'écrire. Trop bas, il s'arrête avant sa réponse (erreur « réponse tronquée »).
- `RODIUM_JSON_MODE` (`false`) : le « mode JSON » de l'API renvoie une réponse vide avec ce modèle ; le prompt demande déjà du JSON.
- `ALLOWED_ORIGINS` : adresse(s) du frontend autorisées (CORS), par exemple l'adresse Vercel.

## Déployer sur Render

`render.yaml` (à la racine du dépôt) décrit le service. Render : *New > Blueprint*, choisir le dépôt, puis saisir les valeurs
marquées secrètes. Prendre un plan qui ne s'endort pas : la préparation d'un cours tourne en arrière-plan et serait coupée
si le service s'arrête. Puis, dans Vercel, `NEXT_PUBLIC_API_URL` = l'adresse du service Render.

## Limites connues

- Le format `.ppt` (ancien, binaire) est refusé avec un message clair : il faut l'enregistrer en `.pptx`.
- Pas d'OCR : un PDF scanné ou une photo est refusé (`unreadable`), comme prévu par le design (écran 28).
- Le traitement tourne dans le même processus que l'API (tâche d'arrière-plan). Si des étudiants nombreux envoient des
  cours en même temps, passer à une file de tâches (Redis ou Cloud Tasks).
- Un cours créé dont le fichier n'a pas pu être envoyé est marqué `error` / `upload` : l'étudiant peut en ajouter un nouveau.
