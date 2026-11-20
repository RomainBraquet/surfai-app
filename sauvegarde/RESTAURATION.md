# Sauvegarde de SurfAI : ce qui est fait, et comment restaurer

## Ce qui est sauvegardé, chaque soir à 20h15

Dossier de destination : `~/SURFAI SAUVEGARDE`, synchronisé par Google Drive.

| Dossier | Contenu |
|---|---|
| `BASE/surfai-AAAA-MM-JJ.tar.gz.enc` | Export chiffré de la base (toutes les tables sauf les caches de prévisions), liste des comptes, fichiers stockés (photos de profil et de boards) |
| `surfai/` | Copie miroir du projet, sans les secrets ni les dépendances |
| `_corbeille/` | Ce qui a été supprimé du projet, gardé 30 jours |
| `_journal/` | Le journal de chaque sauvegarde |
| `DERNIERE-SAUVEGARDE.txt` | Le résultat du dernier passage (`base=0 projet=0` = tout va bien) |

Durée de conservation des exports : 30 jours, plus celui du 1er de chaque mois pendant 13 mois.

## La phrase de chiffrement

Elle est dans `surfai/backend/.env`, ligne `SURFAI_ENC_PASSPHRASE`. Ce fichier n'est copié ni sur GitHub ni sur le Drive.
**Sans cette phrase, les exports sont illisibles.** Une copie doit exister ailleurs que sur ce Mac (application Mots de passe).

## Lancer une sauvegarde à la main

```bash
"/Users/imac/ANTIGRAVITY x CLAUDE/surfai/sauvegarde/sauvegarder.sh"
```

## Ouvrir un export

```bash
cd ~/Desktop && SURFAI_PHRASE='LA-PHRASE' openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:SURFAI_PHRASE -in "$HOME/SURFAI SAUVEGARDE/BASE/surfai-AAAA-MM-JJ.tar.gz.enc" | tar -xzf -
```

On obtient un dossier `export/` :
- `MANIFESTE.json` : le nombre de lignes par table
- `base/NOM-DE-TABLE.json` : le contenu de chaque table
- `base/_comptes.json` : les comptes (identifiant, adresse, date), sans les mots de passe
- `fichiers/avatars/` : les photos

## Restaurer

Les tables se réinjectent une par une dans Supabase à partir des fichiers JSON (éditeur de tables, « Import data », ou un script). Ordre : `spots`, `profiles`, `boards`, `sessions`, puis le reste.

Limite à connaître : les mots de passe des comptes ne sont pas dans l'export (Supabase ne les donne pas par ce chemin). Après une perte totale, chaque personne devrait recréer son mot de passe ou se reconnecter avec Google. Les identifiants des comptes sont conservés dans `_comptes.json`, ce qui permet de rattacher les sessions et les boards.

## La tâche automatique

Fichier : `~/Library/LaunchAgents/fr.surfai.sauvegarde.plist` (modèle dans ce dossier).

```bash
launchctl list | grep surfai
```

Journal de la tâche : `~/Library/Logs/surfai-sauvegarde.log`.
