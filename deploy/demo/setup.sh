#!/usr/bin/env bash
# Convierte una instalación del instrumento en la demo pública (D125), en la EC2 de AWS.
# Se lanza después de deploy/install.sh, que deja el motor en /opt/moodtable, y desde ella:
#   sudo bash /opt/moodtable/deploy/demo/setup.sh
#
# Qué hace, en orden:
#   1. deja config/cloud.json como fichero de configuración (dos tiras virtuales, estado en memoria,
#      el motor solo en 127.0.0.1);
#   2. instala Caddy, de su repositorio oficial, con el Caddyfile de la demo (HTTPS y proxy al motor);
#   3. añade a moodtable.service el drop-in con Restart=on-failure, solo en la demo;
#   4. registra el temporizador que reinicia el motor cada 3 horas, para volver al estado inicial;
#   5. reinicia el motor y dice dónde está la demo.
# Se puede volver a lanzar: cada paso deja lo mismo aunque ya estuviera hecho. Tras reinstalar con
# install.sh (que deja otra vez la configuración base), hay que volver a lanzarlo.
set -Eeuo pipefail

readonly INSTALL_DIR='/opt/moodtable'
readonly DEMO_DIR="${INSTALL_DIR}/deploy/demo"
readonly SERVICE='moodtable'
readonly SERVICE_USER='moodtable'
readonly DROP_IN_DIR="/etc/systemd/system/${SERVICE}.service.d"
readonly RESET='moodtable-reset'
readonly DOMAIN='moodtable.josebaalonso.tech'
readonly CADDY_REPO='https://dl.cloudsmith.io/public/caddy/stable'
readonly CADDY_KEYRING='/usr/share/keyrings/caddy-stable-archive-keyring.gpg'

info() {
  printf '\n==> %s\n' "$*"
}

fail() {
  printf '\nError: %s\n' "$*" >&2
  exit 1
}

on_error() {
  printf '\nLa demo no ha quedado lista: falló la línea %s del script (el motivo, justo encima).\n' "$1" >&2
}

check_prerequisites() {
  if [[ $EUID -ne 0 ]]; then
    fail "hay que lanzarlo con sudo: sudo bash ${DEMO_DIR}/setup.sh"
  fi
  if [[ ! -f "${INSTALL_DIR}/config/cloud.json" ]]; then
    fail "no hay una instalación del instrumento en ${INSTALL_DIR}: lanza antes deploy/install.sh"
  fi
}

# Paso 1. Sustituye la configuración base que deja install.sh (la demo de una tira en 0.0.0.0).
write_config() {
  info 'Dejando config/cloud.json como fichero de configuración'
  install --owner="$SERVICE_USER" --group="$SERVICE_USER" --mode=0644 \
    "${INSTALL_DIR}/config/cloud.json" "${INSTALL_DIR}/config/local.json"
}

# Paso 2. Del repositorio oficial de Caddy (https://caddyserver.com/docs/install), no del de Ubuntu:
# el de Ubuntu 24.04 se quedó en la 2.6, de 2022. Se actualiza con `apt upgrade`. El paquete
# registra y arranca caddy.service.
install_caddy() {
  info 'Instalando Caddy'
  apt-get update
  apt-get install --yes curl gpg
  curl -1sLf "${CADDY_REPO}/gpg.key" |
    gpg --dearmor --batch --yes -o "$CADDY_KEYRING"
  curl -1sLf "${CADDY_REPO}/debian.deb.txt" >/etc/apt/sources.list.d/caddy-stable.list
  chmod o+r "$CADDY_KEYRING" /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install --yes caddy
  install --mode=0644 "${DEMO_DIR}/Caddyfile" /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  systemctl enable caddy
  systemctl reload-or-restart caddy
}

# Pasos 3 y 4. El drop-in no toca deploy/moodtable.service, que es la unidad de la mesa (D106).
install_units() {
  info 'Registrando el rearranque del motor y el temporizador de la demo'
  install -d "$DROP_IN_DIR"
  install --mode=0644 "${DEMO_DIR}/moodtable-demo.conf" "${DROP_IN_DIR}/demo.conf"
  install --mode=0644 "${DEMO_DIR}/${RESET}.service" "/etc/systemd/system/${RESET}.service"
  install --mode=0644 "${DEMO_DIR}/${RESET}.timer" "/etc/systemd/system/${RESET}.timer"
  systemctl daemon-reload
  systemctl enable --now "${RESET}.timer"
}

# Paso 5.
restart_engine() {
  info 'Reiniciando el motor con la configuración de la demo'
  systemctl restart "$SERVICE"
  sleep 3
  systemctl is-active --quiet "$SERVICE" ||
    fail "el motor no ha arrancado; el motivo, en: journalctl -u ${SERVICE} -b"

  printf '\nLa demo está en https://%s\n' "$DOMAIN"
  printf 'Si el certificado aún no está, Caddy lo pide en cuanto el registro A apunte aquí: journalctl -u caddy\n'
  printf 'El próximo reinicio al estado inicial: systemctl list-timers %s.timer\n' "$RESET"
  printf 'El registro del motor: journalctl -u %s -b\n' "$SERVICE"
}

main() {
  check_prerequisites
  trap 'on_error $LINENO' ERR
  export DEBIAN_FRONTEND=noninteractive
  write_config
  install_caddy
  install_units
  restart_engine
}

main "$@"
