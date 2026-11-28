/** Compte, connexion, onboarding, préparation de l'espace, profil, installation. */
export const EN_AUTH: Record<string, string> = {
  // Valeurs stockées affichées telles quelles
  "Licence 1": "Bachelor's, year 1",
  "Licence 2": "Bachelor's, year 2",
  "Licence 3": "Bachelor's, year 3",
  "Master 1": "Master's, year 1",
  "Master 2": "Master's, year 2",
  "Français": "French",
  "English": "English",

  // Composants
  "Compte": "Account",
  "Se connecter": "Sign in",
  "Créer un compte": "Create an account",
  "Mode démo : Firebase n’est pas configuré, les données restent dans ce navigateur.":
    "Demo mode: Firebase is not set up, so your data stays in this browser.",
  "(optionnel)": "(optional)",
  "Masquer le mot de passe": "Hide password",
  "Afficher le mot de passe": "Show password",
  "Installer l’application": "Install the app",
  "Installe PlugStudy": "Install PlugStudy",
  "Ouvre l’application comme une app, directement depuis ton écran d’accueil.":
    "Open PlugStudy like an app, straight from your home screen.",
  "Touche le bouton Partager, puis « Sur l’écran d’accueil » pour ouvrir PlugStudy comme une app.":
    "Tap the Share button, then “Add to Home Screen” to open PlugStudy like an app.",
  "Installer": "Install",
  "Plus tard": "Later",

  // Connexion
  "Connecte-toi pour commencer": "Sign in to get started",
  "Adresse e-mail": "Email address",
  "Mot de passe": "Password",
  "Ton mot de passe": "Your password",
  "Mot de passe oublié ?": "Forgot your password?",
  "Connexion…": "Signing in…",
  "ou": "or",
  "Ouverture de Google…": "Opening Google…",
  "Continuer avec Google": "Continue with Google",
  "Tes cours restent privés. Tu peux supprimer ton compte à tout moment.":
    "Your courses stay private. You can delete your account at any time.",
  "Écris ton adresse e-mail et ton mot de passe.": "Enter your email address and password.",

  // Inscription
  "Crée ton compte": "Create your account",
  "Nom complet": "Full name",
  "Prénom et nom": "First and last name",
  "Choisis un mot de passe": "Choose a password",
  "8 caractères minimum.": "At least 8 characters.",
  "J’accepte les conditions d’utilisation": "I accept the terms of use",
  "Création du compte…": "Creating your account…",
  "Créer mon compte": "Create my account",
  "Tu as déjà un compte ?": "Already have an account?",
  "Écris ton nom complet.": "Enter your full name.",
  "Écris ton adresse e-mail.": "Enter your email address.",
  "Cette adresse e-mail n’est pas valide.": "This email address is not valid.",
  "Ton mot de passe doit avoir au moins 8 caractères.": "Your password must be at least 8 characters long.",
  "Accepte les conditions d’utilisation pour continuer.": "Accept the terms of use to continue.",

  // Vérification de l'e-mail
  "Vérifie ta boîte mail": "Check your inbox",
  "Nous avons envoyé un lien de vérification à": "We sent a verification link to",
  "Ouvre-le pour confirmer ton adresse.": "Open it to confirm your address.",
  "Tu ne vois rien ? Regarde dans tes courriers indésirables (spam).":
    "Can’t see it? Check your spam folder.",
  "Vérification…": "Checking…",
  "J’ai ouvert le lien": "I opened the link",
  "Renvoyer le lien dans {delay}": "Resend the link in {delay}",
  "Renvoyer le lien": "Resend the link",
  "Changer d’adresse e-mail": "Change email address",
  "Ton adresse n’est pas encore confirmée. Ouvre le lien reçu par e-mail, puis réessaie.":
    "Your address isn’t confirmed yet. Open the link we emailed you, then try again.",
  "Lien renvoyé. Regarde ta boîte mail.": "Link sent again. Check your inbox.",

  // Mot de passe oublié
  "← Retour à la connexion": "← Back to sign in",
  "Mot de passe oublié": "Forgot your password",
  "Écris l’adresse e-mail de ton compte. Nous t’envoyons un lien pour choisir un nouveau mot de passe.":
    "Enter the email address of your account. We’ll send you a link to choose a new password.",
  "Si un compte existe avec {email}, tu vas recevoir un lien dans quelques instants. Pense à regarder dans tes courriers indésirables.":
    "If an account exists for {email}, you’ll receive a link in a few moments. Remember to check your spam folder.",
  "Envoi…": "Sending…",
  "Envoyer le lien": "Send the link",

  // Onboarding
  "Pour commencer": "Get started",
  "Permets-nous de mieux te connaître": "Help us get to know you",
  "Trois choix pour adapter PlugStudy à tes cours. Tu pourras les modifier plus tard.":
    "Three choices to tailor PlugStudy to your courses. You can change them later.",
  "Niveau d’étude": "Level of study",
  "Filière": "Field of study",
  "Écris-la comme sur ton emploi du temps, par exemple Informatique ou Droit.":
    "Write it as it appears on your timetable, for example Computer Science or Law.",
  "Écris ta filière": "Enter your field of study",
  "Université ou école": "University or school",
  "Par exemple UAC, UPM ou le nom de ton école.": "For example UAC, UPM or the name of your school.",
  "Écris ton université ou ton école": "Enter your university or school",
  "Langue": "Language",
  "Enregistrement…": "Saving…",
  "Continuer": "Continue",
  "Ces informations servent à préparer des cours types pour ta filière.":
    "This information is used to prepare sample courses for your field of study.",
  "Écris ta filière.": "Enter your field of study.",
  "Écris ton université ou ton école.": "Enter your university or school.",
  "Impossible d’enregistrer ton profil. Vérifie ta connexion et réessaie.":
    "We couldn’t save your profile. Check your connection and try again.",

  // Préparation
  "(terminé)": "(done)",
  "(en cours)": "(in progress)",
  "(à venir)": "(coming up)",
  "Ton espace se prépare": "Your space is getting ready",
  "Préparation de ton espace": "Preparing your space",
  "Profil créé": "Profile created",
  "Préparation des cours types : {filiere}, {niveau}": "Preparing sample courses: {filiere}, {niveau}",
  "Ton tableau de bord": "Your dashboard",
  "Les cours types sont une base de départ. Tu peux déposer tes propres cours à tout moment.":
    "Sample courses are a starting point. You can upload your own courses at any time.",
  "Ton espace est vide pour l’instant : dépose ton premier cours et l’IA le lira pour toi.":
    "Your space is empty for now: upload your first course and the AI will read it for you.",
  "Aller à l’accueil": "Go to home",

  // Profil
  "Profil": "Profile",
  "Ton profil": "Your profile",
  "Bientôt disponible": "Coming soon",
  "Changer la photo": "Change photo",
  "Se déconnecter": "Sign out",
  "Supprimer mon compte": "Delete my account",
  "Tout sera supprimé": "Everything will be deleted",
  "Tes cours et leurs fichiers": "Your courses and their files",
  "Tes fiches, tes notions et tes quiz": "Your summaries, notions and quizzes",
  "Tes conversations avec l’assistant": "Your conversations with the assistant",
  "Ton profil et ton adresse e-mail": "Your profile and your email address",
  "SUPPRIMER": "DELETE",
  "Pour confirmer, écris {mot}": "To confirm, type {mot}",
  "Cette action est définitive : tes données ne pourront pas être récupérées.": "This can’t be undone: your data can’t be recovered.",
  "Supprimer définitivement": "Delete permanently",
  "Suppression…": "Deleting…",
  "Annuler": "Cancel",
  "La suppression n’est pas disponible pour le moment. Réessaie plus tard.": "Deleting isn’t available right now. Try again later.",
  "Impossible de supprimer ton compte pour le moment. Réessaie dans un instant.": "We can’t delete your account right now. Try again in a moment.",
  "Écris ton nom.": "Enter your name.",
  "Modifications enregistrées.": "Changes saved.",
  "Enregistrer les modifications": "Save changes",
  "Impossible d’enregistrer tes modifications. Vérifie ta connexion et réessaie.":
    "We couldn’t save your changes. Check your connection and try again.",

  // Messages d'erreur construits hors composant (lib/backend, auth-context)
  "Une erreur est survenue. Réessaie.": "Something went wrong. Please try again.",
  "E-mail ou mot de passe incorrect.": "Incorrect email or password.",
  "Trop de tentatives. Réessaie dans quelques minutes.": "Too many attempts. Try again in a few minutes.",
  "Pas de connexion. Vérifie ton réseau et réessaie.": "No connection. Check your network and try again.",
  "La connexion avec Google a été annulée.": "Google sign-in was cancelled.",
  "Ton navigateur a bloqué la fenêtre Google. Autorise-la puis réessaie.":
    "Your browser blocked the Google window. Allow it, then try again.",
  "Un compte existe déjà avec cette adresse. Connecte-toi.": "An account already exists with this address. Sign in.",
  "Ton mot de passe est trop faible. Utilise au moins 8 caractères.":
    "Your password is too weak. Use at least 8 characters.",
  "Ce compte est désactivé.": "This account has been disabled.",
  "Ta session a expiré. Connecte-toi de nouveau.": "Your session has expired. Please sign in again.",
  "Impossible d’ajouter le cours. Vérifie ta connexion et réessaie.":
    "We couldn’t add the course. Check your connection and try again.",
  "Firebase n'est pas configuré. Copie .env.example vers .env.local et remplis les valeurs.":
    "Firebase is not set up. Copy .env.example to .env.local and fill in the values.",
};
