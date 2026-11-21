// Générateurs d'images de partage (session et board), repris à l'identique de l'ancienne app.
// Ne pas réécrire : ils produisent les cartes Instagram validées.
var userData = window.userData || (window.userData = { boards: [], sessions: [], profile: {} });

// loadImage : repris tel quel de l'ancienne version (lignes 5524 à 5538)
        function loadImage(file) {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            if (file instanceof File) {
              const reader = new FileReader();
              reader.onload = (e) => { img.src = e.target.result; };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            } else {
              img.src = file;
            }
          });
        }

// drawImageCover : repris tel quel de l'ancienne version (lignes 5540 à 5556)
        function drawImageCover(ctx, img, x, y, w, h) {
          const imgRatio = img.width / img.height;
          const canvasRatio = w / h;
          let sx, sy, sw, sh;
          if (imgRatio > canvasRatio) {
            sh = img.height;
            sw = sh * canvasRatio;
            sx = (img.width - sw) / 2;
            sy = 0;
          } else {
            sw = img.width;
            sh = sw / canvasRatio;
            sx = 0;
            sy = (img.height - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        }

// generateShareCard : repris tel quel de l'ancienne version (lignes 5558 à 5642)
// Texte centré avec icônes : « [[wave]] 1,2 m » dessine l'icône de l'app à la taille du texte.
// Les icônes viennent du jeu unique (SurfV4.ICON), pour que les images parlent comme l'app.
        function richText(ctx, text, x, y) {
          text = String(text == null ? '' : text);
          var ICON = (window.SurfV4 && window.SurfV4.ICON) || {};
          var segs = text.split(/(\[\[\w+\]\])/).filter(function (t) { return t !== ''; });
          var has = segs.some(function (t) { return /^\[\[\w+\]\]$/.test(t) && ICON[t.slice(2, -2)]; });
          if (!has) { ctx.fillText(text.replace(/\[\[\w+\]\]\s?/g, ''), x, y); return; }
          var px = parseFloat((/(\d+(?:\.\d+)?)px/.exec(ctx.font) || [0, 24])[1]), size = px * 1.05, gap = px * 0.12;
          var items = segs.map(function (t) {
            var name = /^\[\[(\w+)\]\]$/.exec(t);
            return name && ICON[name[1]] ? { icon: name[1], w: size + gap } : { text: t, w: ctx.measureText(t).width };
          });
          var total = items.reduce(function (a, i) { return a + i.w; }, 0), cur = x - total / 2;
          ctx.save(); ctx.textAlign = 'left';
          items.forEach(function (i) {
            if (i.text != null) { ctx.fillText(i.text, cur, y); cur += i.w; return; }
            var svg = ICON[i.icon], k = size / 24, path = new Path2D();
            (svg.match(/ d="[^"]+"/g) || []).forEach(function (d) { path.addPath(new Path2D(d.slice(4, -1))); });
            (svg.match(/<circle[^>]+>/g) || []).forEach(function (c) {
              var g = function (a) { return parseFloat((new RegExp(a + '="([\\d.]+)"').exec(c) || [0, 0])[1]); };
              var p2 = new Path2D(); p2.arc(g('cx'), g('cy'), g('r'), 0, Math.PI * 2); path.addPath(p2);
            });
            ctx.save(); ctx.translate(cur, y - size * 0.86); ctx.scale(k, k);
            if (i.icon === 'star') { ctx.fill(path); }
            else { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(path); }
            ctx.restore(); cur += i.w;
          });
          ctx.restore();
        }

        async function generateShareCard(photo, sessionData) {
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1350;
          const ctx = canvas.getContext('2d');

          // 1. Draw photo as background (crop center cover)
          const img = await loadImage(photo);
          drawImageCover(ctx, img, 0, 0, 1080, 1350);

          // 2. Gradient overlay on bottom half
          const grad = ctx.createLinearGradient(0, 600, 0, 1350);
          grad.addColorStop(0, 'rgba(235,242,255,0)');
          grad.addColorStop(0.4, 'rgba(235,242,255,0.6)');
          grad.addColorStop(1, 'rgba(235,242,255,0.9)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 600, 1080, 750);

          // 3. Text overlay — build from bottom up
          ctx.textAlign = 'center';
          const cx = 540; // center x
          let curY = 1290; // start near bottom

          // Date
          const dateStr = formatSessionDate(sessionData.date);
          ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          richText(ctx, dateStr, cx, curY);
          curY -= 50;

          // Rating stars + nickname line
          const parts = [];
          if (sessionData.rating) {
            parts.push('[[star]]'.repeat(sessionData.rating));
          }
          if (sessionData.nickname) {
            parts.push('@' + sessionData.nickname);
          }
          if (parts.length > 0) {
            ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#1a1a1a';
            richText(ctx, parts.join('  ·  '), cx, curY);
            curY -= 50;
          }

          // Conditions line (meteo)
          if (sessionData.meteo) {
            const m = sessionData.meteo;
            const condParts = [];
            if (m.waveHeight != null) condParts.push('[[wave]] ' + m.waveHeight + ' m');
            if (m.windSpeed != null) {
              let windStr = m.windSpeed + ' km/h';
              if (m.windDirection) windStr += ' ' + m.windDirection;
              condParts.push('[[wind]] ' + windStr);
            }
            if (m.wavePeriod != null) condParts.push('[[period]] ' + m.wavePeriod + ' s');
            if (condParts.length > 0) {
              ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
              ctx.fillStyle = '#56AB2F';
              richText(ctx, condParts.join('  ·  '), cx, curY);
              curY -= 55;
            }
          }

          // City
          if (sessionData.spotCity) {
            ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            richText(ctx, sessionData.spotCity, cx, curY);
            curY -= 45;
          }

          // Spot name
          ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#1a1a1a';
          richText(ctx, sessionData.spotName, cx, curY);
          curY -= 55;

          // SurfAI logo text
          ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#3B82F6';
          richText(ctx, 'SurfAI', cx, curY);

          return canvas;
        }

// downloadShareCard : repris tel quel de l'ancienne version (lignes 5644 à 5656)
        function downloadShareCard(canvas, sessionData) {
          canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = (sessionData.spotName || 'session').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            a.download = `surfai-${safeName}-${sessionData.date}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 'image/png');
        }

// shareCard : repris tel quel de l'ancienne version (lignes 5658 à 5680)
        async function shareCard(canvas, sessionData) {
          try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const safeName = (sessionData.spotName || 'session').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const file = new File([blob], `surfai-${safeName}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: `Session surf - ${sessionData.spotName}`,
                text: `Session a ${sessionData.spotName} via SurfAI`
              });
            } else {
              // Fallback to download
              downloadShareCard(canvas, sessionData);
            }
          } catch (e) {
            if (e.name !== 'AbortError') {
              // User didn't cancel, fallback to download
              downloadShareCard(canvas, sessionData);
            }
          }
        }

// generateBoardShareCanvas : repris tel quel de l'ancienne version (lignes 4573 à 4649)
        async function generateBoardShareCanvas(photoFile, data, detailLine, bottomLine, mode) {
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1350;
          const ctx = canvas.getContext('2d');

          // Photo en fond
          const img = await loadImage(photoFile);
          drawImageCover(ctx, img, 0, 0, 1080, 1350);

          // Gradient overlay
          const grad = ctx.createLinearGradient(0, 500, 0, 1350);
          grad.addColorStop(0, 'rgba(235,242,255,0)');
          grad.addColorStop(0.4, 'rgba(235,242,255,0.6)');
          grad.addColorStop(1, 'rgba(235,242,255,0.92)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 500, 1080, 850);

          ctx.textAlign = 'center';
          const cx = 540;
          let curY = 1290;

          // Accent couleur selon mode
          const accentColors = { flex: '#56AB2F', sell: '#ed8936', repair: '#3B82F6' };
          const accent = accentColors[mode] || '#56AB2F';

          // Bottom line (SurfAI ou message)
          ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          richText(ctx, bottomLine, cx, curY);
          curY -= 50;

          // Detail line
          if (detailLine) {
            ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#1a1a1a';
            richText(ctx, detailLine, cx, curY);
            curY -= 50;
          }

          // Accent line (conditions / prix / description)
          if (data.meteo?.line) {
            ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = accent;
            richText(ctx, data.meteo.line, cx, curY);
            curY -= 55;
          }

          // Date/shaper
          if (data.date) {
            ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            richText(ctx, data.date, cx, curY);
            curY -= 45;
          }

          // Subtitle (dims)
          if (data.spotCity) {
            ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            richText(ctx, data.spotCity, cx, curY);
            curY -= 45;
          }

          // Title (board name)
          ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#1a1a1a';
          richText(ctx, data.spotName, cx, curY);
          curY -= 55;

          // Logo SurfAI en haut
          ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          richText(ctx, 'SurfAI', cx, 40);

          return canvas;
        }

// formatSessionDate : repris tel quel de l'ancienne version (lignes 5435 à 5439)
        function formatSessionDate(dateStr) {
          const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
          const d = new Date(dateStr + 'T00:00:00');
          return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        }

// formatSweetSpot : repris tel quel de l'ancienne version (lignes 3863 à 3873)
        function formatSweetSpot(b) {
          const parts = [];
          if (b.sweet_spot_wave_min || b.sweet_spot_wave_max) {
            const min = b.sweet_spot_wave_min || '?';
            const max = b.sweet_spot_wave_max || '?';
            parts.push(`${min}-${max}m`);
          }
          if (b.sweet_spot_wind && b.sweet_spot_wind !== 'any') parts.push(b.sweet_spot_wind);
          if (b.sweet_spot_tide && b.sweet_spot_tide !== 'any') parts.push('marée ' + b.sweet_spot_tide);
          return parts.length ? parts.join(' · ') : null;
        }

// getBoardSessionStats : repris tel quel de l'ancienne version (lignes 3853 à 3861)
        function getBoardSessionStats(boardId) {
          const sessions = (userData.sessions || []).filter(s => s.board_id == boardId);
          if (!sessions.length) return { count: 0, lastDate: null };
          const sorted = sessions.sort((a,b) => new Date(b.date) - new Date(a.date));
          const last = new Date(sorted[0].date);
          const diffDays = Math.round((Date.now() - last) / 86400000);
          const lastTxt = diffDays === 0 ? "aujourd'hui" : diffDays === 1 ? 'hier' : `il y a ${diffDays}j`;
          return { count: sessions.length, lastDate: lastTxt };
        }

// getBoardTypeIcon : repris tel quel de l'ancienne version (lignes 3848 à 3851)
        function getBoardTypeIcon(type) {
          const icons = { shortboard:'🏄', fish:'🐟', midlength:'🌊', longboard:'🛹', gun:'🎯', funboard:'😎', hybrid:'⚡', foil:'🪁', sup:'🚣' };
          return icons[type] || '🏄';
        }
