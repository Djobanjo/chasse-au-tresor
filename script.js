const map = L.map('map').setView([-20.9062, 55.4871], 17);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let etapes = [];
let etapeActuelle = 0;
let userMarker;
let dernierePosition = null;
let departInitialise = false;
let enigmeEnCours = false;

document.getElementById("btn-moi").addEventListener("click", () => {
  if (dernierePosition) {
    map.setView([dernierePosition.lat, dernierePosition.lng], 17);
  } else {
    alert("📍 Position utilisateur non encore connue.");
  }
});

function ajouterPointSurCarte(lat, lng, titre) {
  L.marker([lat, lng], {
    title: titre,
    icon: L.icon({
      iconUrl: "https://cdn-icons-png.flaticon.com/512/252/252025.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    })
  }).addTo(map);
}

function checkProximite(userLat, userLng, etape, tol = 0.0007) {
  return (
    Math.abs(userLat - etape.lat) < tol &&
    Math.abs(userLng - etape.lng) < tol &&
    !etape.valide
  );
}

function verifierPosition(userLat, userLng) {
  if (enigmeEnCours) return; // bloquer si énigme ouverte

  const etape = etapes[etapeActuelle];
  if (checkProximite(userLat, userLng, etape)) {
    enigmeEnCours = true;
    afficherEnigme(etape, etapeActuelle);
  }
}

function normaliser(str) {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .replace(/\s+/g, " ");
}

function afficherEnigme(etape, index) {
  // Cacher la carte et boutons
  document.getElementById('map').style.display = 'none';
  document.getElementById('btn-moi').style.display = 'none';
  document.getElementById('etat').style.display = 'none';

  const container = document.getElementById('enigme-container');
  container.style.display = 'block';

  document.getElementById('titre-enigme').innerText = `📍 ${etape.nom}`;
  document.getElementById('texte-enigme').innerText = etape.enigme;
  document.getElementById('reponse-utilisateur').value = '';
  document.getElementById('feedback').innerText = '';

  document.getElementById('valider-reponse').onclick = () => {
    const reponseUser = normaliser(document.getElementById('reponse-utilisateur').value);
    const bonnesReponses = etape.reponses.map(normaliser);
    if (bonnesReponses.includes(reponseUser)) {
      etapes[index].valide = true;
      document.getElementById('feedback').innerText = "✅ Bonne réponse !";

      setTimeout(() => {
        container.style.display = 'none';
        document.getElementById('map').style.display = 'block';
        document.getElementById('btn-moi').style.display = 'block';
        document.getElementById('etat').style.display = 'block';

        document.getElementById("etat").innerText = `✔️ Étape validée : ${etape.nom}`;
        ajouterPointSurCarte(etape.lat, etape.lng, `✅ ${etape.nom}`);

        etapeActuelle++;
        if (etapeActuelle < etapes.length) {
          ajouterPointSurCarte(etapes[etapeActuelle].lat, etapes[etapeActuelle].lng, etapes[etapeActuelle].nom);
        } else {
          alert("🎉 Chasse au trésor terminée !");
        }
        enigmeEnCours = false;
      }, 1500);
    } else {
      document.getElementById('feedback').innerText = "❌ Mauvaise réponse. Essaie encore !";
    }
  };

  document.getElementById('annuler-enigme').onclick = () => {
    container.style.display = 'none';
    document.getElementById('map').style.display = 'block';
    document.getElementById('btn-moi').style.display = 'block';
    document.getElementById('etat').style.display = 'block';
    enigmeEnCours = false;
  };
}

const SEUIL_DISTANCE = 0.0001; // ~10m approx.

function lancerWatchPosition() {
  navigator.geolocation.watchPosition(pos => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    document.getElementById("etat").innerText = `Position reçue : ${userLat.toFixed(5)}, ${userLng.toFixed(5)}`;

    if (dernierePosition) {
      const deltaLat = Math.abs(userLat - dernierePosition.lat);
      const deltaLng = Math.abs(userLng - dernierePosition.lng);
      if (deltaLat < SEUIL_DISTANCE && deltaLng < SEUIL_DISTANCE) {
        // Pas assez de mouvement, on ignore
        return;
      }
    }
    dernierePosition = { lat: userLat, lng: userLng };

    if (!departInitialise) {
      etapes = [
        {
          nom: "🎯 Point de départ",
          lat: userLat,
          lng: userLng,
          enigme: "Mon emplacement tu trouveras, le savoir tu auras",
          reponses: ["bibliothèque universitaire", "bibliotheque universitaire", "bibliothèque", "bibliotheque", "bu", "BU"],
          valide: false
        },
        {
          nom: "📚 Bibliothèque Universitaire",
          lat: -20.901358,
          lng: 55.483038,
          enigme: "Quel est le nom de l’université ?",
          reponses: ["université de la réunion", "universite de la reunion", "univ reunion", "université réunion"],
          valide: false
        },
        {
          nom: "🏛️ Amphi A",
          lat: -20.90510,
          lng: 55.48815,
          enigme: "Combien y a-t-il d’amphis au bâtiment A ?",
          reponses: ["3", "trois"],
          valide: false
        }
      ];

      ajouterPointSurCarte(etapes[0].lat, etapes[0].lng, etapes[0].nom);
      departInitialise = true;
    }

    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([userLat, userLng], {
      title: "Tu es ici",
      icon: L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      })
    }).addTo(map);

    map.setView([userLat, userLng]);
    verifierPosition(userLat, userLng);

  }, err => {
    alert("Erreur de géolocalisation : " + err.message);
  });
}

// Gérer la permission avec l’API Permissions et localStorage

async function demarrerGeoloc() {
  if (!navigator.geolocation) {
    alert("La géolocalisation n'est pas supportée par votre navigateur.");
    return;
  }

  try {
    if (!localStorage.getItem("geolocAccepted")) {
      // On vérifie le statut de permission
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });

      if (permissionStatus.state === 'granted') {
        // Déjà accordée
        localStorage.setItem("geolocAccepted", "true");
        lancerWatchPosition();
      } else if (permissionStatus.state === 'prompt') {
        // Demander permission avec watchPosition, la première déclenchera la popup
        lancerWatchPosition();
        // On enregistre au premier succès dans watchPosition
      } else {
        // denied
        alert("La géolocalisation a été refusée. Veuillez autoriser pour continuer.");
      }

      // Écoute les changements de permission
      permissionStatus.onchange = () => {
        if (permissionStatus.state === 'granted') {
          localStorage.setItem("geolocAccepted", "true");
          lancerWatchPosition();
        }
      };
    } else {
      // permission déjà acceptée auparavant
      lancerWatchPosition();
    }
  } catch (e) {
    // Si l’API Permissions n’est pas supportée, on essaye direct la géoloc (sera demandée une fois)
    lancerWatchPosition();
  }
}

demarrerGeoloc();
