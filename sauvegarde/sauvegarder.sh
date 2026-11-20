#!/bin/bash
# Sauvegarde de SurfAI : export chiffré de la base et des fichiers stockés, puis copie miroir du projet.
# Usage : ./sauvegarder.sh [DESTINATION]   (sans argument : ~/SURFAI SAUVEGARDE, synchronisé par Google Drive)
# Copie miroir (rsync) : ce qui est supprimé ici est déplacé dans _corbeille/AAAA-MM-JJ, jamais perdu.

set -u
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
SRC="/Users/imac/ANTIGRAVITY x CLAUDE/surfai"
DEST="${1:-$HOME/SURFAI SAUVEGARDE}"
JOUR=$(date +%Y-%m-%d)
LOG="$DEST/_journal/$JOUR.log"
mkdir -p "$DEST/_journal" "$DEST/_corbeille/$JOUR" "$DEST/BASE"

# ── 1. Base et fichiers stockés : export, archive, chiffrement, vérification ──
exporter_base() {
  local PHRASE TMP ARCHIVE
  PHRASE=$(grep '^SURFAI_ENC_PASSPHRASE=' "$SRC/backend/.env" | cut -d= -f2-)
  [ -n "$PHRASE" ] || { echo "ÉCHEC : phrase de chiffrement absente de backend/.env"; return 1; }
  TMP=$(mktemp -d) || return 1
  ARCHIVE="$DEST/BASE/surfai-$JOUR.tar.gz.enc"
  local OK=1
  for essai in 1 2 3; do
    rm -rf "$TMP/export"
    if node "$SRC/sauvegarde/exporter.js" "$TMP/export"; then OK=0; break; fi
    echo "Export : essai $essai échoué"; sleep 60
  done
  if [ $OK -ne 0 ]; then rm -rf "$TMP"; return 1; fi
  if ! tar -czf - -C "$TMP" export | SURFAI_PHRASE="$PHRASE" openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:SURFAI_PHRASE -out "$ARCHIVE.partiel"; then
    echo "ÉCHEC : chiffrement"; rm -rf "$TMP" "$ARCHIVE.partiel"; return 1
  fi
  # relecture : l'archive doit se déchiffrer et contenir le manifeste
  if ! SURFAI_PHRASE="$PHRASE" openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:SURFAI_PHRASE -in "$ARCHIVE.partiel" | tar -tzf - | grep -q 'export/MANIFESTE.json'; then
    echo "ÉCHEC : archive illisible après chiffrement"; rm -rf "$TMP" "$ARCHIVE.partiel"; return 1
  fi
  mv "$ARCHIVE.partiel" "$ARCHIVE"
  rm -rf "$TMP"
  echo "$(date '+%Y-%m-%d %H:%M') : $(basename "$ARCHIVE"), $(du -h "$ARCHIVE" | cut -f1), vérifiée" > "$DEST/BASE/DERNIER-EXPORT.txt"
  # on garde 30 jours, et l'export du 1er de chaque mois pendant 13 mois
  find "$DEST/BASE" -name 'surfai-*.tar.gz.enc' -mtime +30 ! -name 'surfai-????-??-01.tar.gz.enc' -delete 2>/dev/null
  find "$DEST/BASE" -name 'surfai-????-??-01.tar.gz.enc' -mtime +400 -delete 2>/dev/null
  return 0
}
exporter_base >>"$LOG" 2>&1
RC0=$?

# ── 2. Copie miroir du projet ──
rsync -a --delete --backup --backup-dir="$DEST/_corbeille/$JOUR/projet" \
  --exclude-from="$SRC/sauvegarde/exclusions.txt" \
  "$SRC/" "$DEST/surfai/" >>"$LOG" 2>&1
RC1=$?

# Corbeille du jour vide : on la retire. Journaux et corbeilles de plus de 30 jours : supprimés.
rmdir "$DEST/_corbeille/$JOUR/projet" "$DEST/_corbeille/$JOUR" 2>/dev/null
find "$DEST/_journal" -name "*.log" -mtime +30 -delete 2>/dev/null
find "$DEST/_corbeille" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} + 2>/dev/null

TAILLE=$(du -sh "$DEST" 2>/dev/null | cut -f1)
echo "Sauvegarde du $JOUR $(date +%H:%M) : base=$RC0 projet=$RC1, taille totale $TAILLE" | tee -a "$LOG" >"$DEST/DERNIERE-SAUVEGARDE.txt"
exit $(( RC0 + RC1 ))
