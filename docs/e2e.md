# Tests end-to-end

## Parcours retenu

### Faits vérifiés dans le dépôt

- L’accueil est accessible sans compte et le mode invité est le mode par défaut (`AppModeService`).
- Le mode invité gère une équipe, un effectif et un match dans `localStorage` via `GuestStateStore` (`benchmaster.guest-state`).
- Le parcours métier existe dans les routes/pages Angular : création d’équipe, préparation du match, suivi en direct, fin du match et résumé. Le résumé invité est obtenu depuis le stockage local.
- Les pages historique, équipes et jeux en mode authentifié s’appuient sur des endpoints protégés et PostgreSQL.
- La CI existante (`.github/workflows/ci.yml`) construit les workspaces frontend et backend ; elle ne provisionne pas PostgreSQL.

### Hypothèses et choix

Le premier scénario automatise le parcours invité complet. Il crée une équipe de six joueurs, prépare cinq titulaires, démarre un match, enregistre des points, termine le match et contrôle le résumé après rechargement. Ce parcours couvre la valeur métier essentielle sans compte, réseau API ni base de données.

Les parcours d’inscription/connexion, la persistance serveur, l’historique et les matchs amicaux nécessitent PostgreSQL et des choix de données/comptes réservés à une base isolée. Ils sont documentés comme suites possibles, mais ne font pas partie de cette première couverture. Le scénario invité utilise des données fictives et un contexte Chromium neuf.

## Exécution

Les E2E sont exécutés par la CI après push, dans le job `Guest game E2E`. Ils ne font pas partie des vérifications locales de routine. Le projet Playwright cible Chromium Desktop Chrome seulement. Les tests utilisent des rôles accessibles et des noms visibles, des attentes liées à l’état de l’interface, aucune temporisation fixe, et conservent traces, captures et vidéos en cas d’échec.

## Isolation et sécurité

Les tests actuels n’utilisent pas de base et ne font aucune requête API dans le parcours invité. `playwright.config.ts` refuse une URL de test qui n’est pas HTTP sur `localhost` ou `127.0.0.1`. Angular génère son URL API via `frontend/scripts/write-env.mjs`; en mode E2E (`E2E=1`), ce script refuse tout `API_BASE_URL` non local. Le scénario ne dépend toutefois pas d’une API locale disponible.

Si une suite authentifiée est ajoutée ultérieurement, elle devra être adossée à une base PostgreSQL dédiée et jetable, avec une URL fournie séparément, des migrations explicites et des données déterministes. Il faudra ajouter un garde-fou côté script backend avant d’autoriser migrations ou nettoyage ; aucune commande de seed globale ne doit être utilisée sur une cible ambiguë.

## CI

Le workflow CI conserve le job `validate` existant et exécute les E2E dans un job `e2e` séparé sur Ubuntu. Il installe Chromium, définit `CI=1` et une URL API loopback inoffensive, puis lance le seul scénario invité. Aucune base de service, variable secrète ou donnée de production n’est configurée. Le rapport Playwright et les résultats de test sont téléversés comme artefacts pendant 14 jours, y compris après échec.

## Résultats et dépannage

Après un échec, télécharger l’artefact `playwright-report` depuis le job `Guest game E2E` et consulter les traces sous `test-results/`. Les rapports et résultats sont ignorés par Git.

## Vérifications

Le dépôt a été inspecté pour les routes, services, modèles, scripts et workflow CI. Le parcours E2E est exécuté par le job CI `Guest game E2E` après push ; il n’est pas lancé en local dans le workflow courant. Les builds locaux requis restent possibles séparément.
