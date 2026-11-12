#!/usr/bin/env bash
# Instala el instrumento en la Raspberry Pi de la mesa (D110, change `table-install`).
# Se lanza por SSH, sin clonar antes el repositorio (README §1.4):
#   curl -fsSL https://raw.githubusercontent.com/7daysofrain/mood-table-v2/main/deploy/install.sh | sudo bash
# Con otra rama o etiqueta como argumento (p. ej. la de una PR, para probarla en la mesa):
#   curl -fsSL https://raw.githubusercontent.com/7daysofrain/mood-table-v2/<rama>/deploy/install.sh | sudo bash -s -- <rama>
#
# Qué hace, en orden (design.md del change, decisión 6):
#   1. busca una instalación existente: la del script o la anterior de la mesa;
#   2. si la hay, pregunta si conservar o sobrescribir su fichero de configuración, y sin una de las
#      dos respuestas termina sin tocar nada;
#   3. instala Node 24 de NodeSource, git y pnpm (corepack), y crea el usuario propio `moodtable`;
#   4. clona la rama en /opt/moodtable.new, instala las dependencias y construye el panel;
#   5. deja el fichero de configuración: el conservado, o el base (la demo, escuchando en todas las
#      interfaces) con una copia .bck del anterior;
#   6. para el servicio, retira la instalación del script si la había (el clon anterior de la mesa
#      se queda), le da la nueva a `moodtable` y la mueve a /opt/moodtable;
#   7. registra la unidad de systemd, la arranca y dice la dirección del panel.
# Todo lo que puede fallar por la red o el disco (3 a 5) pasa antes de tocar /opt/moodtable.
# -E: la trampa de ERR también salta dentro de las funciones.
set -Eeuo pipefail

readonly REPO_URL='https://github.com/7daysofrain/mood-table-v2.git'
readonly INSTALL_DIR='/opt/moodtable'
readonly STAGING_DIR="${INSTALL_DIR}.new"
readonly RETIRED_DIR="${INSTALL_DIR}.old"
readonly SERVICE='moodtable'
readonly SERVICE_USER='moodtable'
readonly UNIT_PATH="/etc/systemd/system/${SERVICE}.service"
# El rango de `engines.node` del package.json raíz (>=24.15 <25), que `pnpm install` exige con
# `engineStrict`. Se copia aquí porque se comprueba antes de clonar; un test vigila que coincidan.
readonly NODE_MAJOR='24'
readonly NODE_MIN_MINOR='15'

# Con `curl … | bash`, la entrada estándar es el propio script: nada de lo que se lanza aquí debe
# leerla, o se comería el resto. Por eso todo está en funciones y `main` se llama en la última línea.

info() {
  printf '\n==> %s\n' "$*"
}

fail() {
  printf '\nError: %s\n' "$*" >&2
  exit 1
}

on_error() {
  printf '\nLa instalación no ha terminado: falló la línea %s del script (el motivo, justo encima).\n' "$1" >&2
}

require_root() {
  if [[ $EUID -ne 0 ]]; then
    fail 'hay que lanzarlo con sudo: curl -fsSL <url del script> | sudo bash'
  fi
}

# La instalación existente: dónde está ('' en una Pi limpia), y qué ha elegido el maker hacer con
# su fichero de configuración (conservar o sobrescribir).
existing_dir=''
config_choice=''

# Paso 1. La del script está en /opt/moodtable; la anterior de la mesa, en el WorkingDirectory de
# la unidad registrada (hoy /home/pi/mood-table-v2), sin dar por hecho dónde.
detect_existing() {
  if [[ -e $INSTALL_DIR ]]; then
    existing_dir=$INSTALL_DIR
  elif service_is_registered; then
    existing_dir=$(systemctl show --property=WorkingDirectory --value "${SERVICE}.service")
  fi
}

# Paso 2. La pregunta se lee de /dev/tty: con `curl … | sudo bash`, la entrada estándar es el propio
# script. Solo valen las dos respuestas; cualquier otra cosa, o no poder preguntar, termina aquí,
# antes de cambiar nada.
ask_config_choice() {
  local answer
  if ! (: </dev/tty) 2>/dev/null; then
    fail "ya hay una instalación del instrumento en ${existing_dir} y no hay una terminal desde la que preguntar qué hacer con su fichero de configuración, así que no ha tocado nada. Lánzalo desde una sesión con terminal (ssh -t)."
  fi

  printf '\nYa hay una instalación del instrumento en %s.\n' "$existing_dir" >/dev/tty
  printf '¿Qué hago con su fichero de configuración (%s)?\n' "${existing_dir}/config/local.json" >/dev/tty
  printf '  conservar     la instalación nueva lo usa tal cual\n' >/dev/tty
  printf '  sobrescribir  la nueva usa el fichero base, y el anterior queda como %s.bck\n' \
    "${INSTALL_DIR}/config/local.json" >/dev/tty
  printf 'En los dos casos, el estado del instrumento empieza de cero.\n' >/dev/tty
  printf 'Escribe conservar o sobrescribir: ' >/dev/tty
  if ! read -r answer </dev/tty; then
    fail 'no se ha podido leer la respuesta, así que no ha tocado nada.'
  fi

  answer=${answer,,}
  case $answer in
    conservar | sobrescribir) config_choice=$answer ;;
    '') fail 'no has elegido conservar ni sobrescribir, así que no ha tocado nada.' ;;
    *) fail "«${answer}» no es conservar ni sobrescribir, así que no ha tocado nada." ;;
  esac

  if [[ $config_choice == 'conservar' && ! -f $(existing_config) ]]; then
    fail "no hay un fichero de configuración que conservar en $(existing_config), así que no ha tocado nada."
  fi
}

existing_config() {
  printf '%s/config/local.json' "$existing_dir"
}

service_is_registered() {
  [[ $(systemctl show --property=LoadState --value "${SERVICE}.service") == 'loaded' ]]
}

# Si /usr/bin/node es una 24 a partir de la 24.15. Una 24 anterior no vale: `pnpm install` la
# rechazaría después, con la instalación a medias.
node_is_supported() {
  local major minor
  [[ -x /usr/bin/node ]] || return 1
  IFS=. read -r major minor _ <<<"$(/usr/bin/node --version | sed 's/^v//')"
  [[ $major == "$NODE_MAJOR" ]] && ((minor >= NODE_MIN_MINOR))
}

# Paso 3. Node 24 en /usr/bin/node (la ruta de la unidad) del repositorio de NodeSource, que lo
# parchea con `apt upgrade` sin salir de la 24. Si ya hay una 24 que vale, no se toca; si es
# anterior a la 24.15, `apt-get install` la actualiza a la última 24.
install_system_packages() {
  info 'Instalando git'
  apt-get update </dev/null
  apt-get install --yes git ca-certificates curl </dev/null

  if node_is_supported; then
    info "Node $(/usr/bin/node --version) ya está instalado"
  else
    info "Instalando Node ${NODE_MAJOR} de NodeSource"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install --yes nodejs </dev/null
    node_is_supported ||
      fail "en /usr/bin/node no ha quedado Node ${NODE_MAJOR}.${NODE_MIN_MINOR} o posterior (dentro de la ${NODE_MAJOR})"
  fi

  info 'Activando pnpm (corepack)'
  corepack enable
}

# El usuario propio: de sistema, sin shell de entrada y sin sudo. dialout abre el puerto serie del
# controlador Adalight y audio, la tarjeta de sonido (arecord).
ensure_service_user() {
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    info "El usuario ${SERVICE_USER} ya existe"
    usermod --append --groups dialout,audio "$SERVICE_USER"
  else
    info "Creando el usuario ${SERVICE_USER}"
    useradd --system --user-group --groups dialout,audio \
      --home-dir "$INSTALL_DIR" --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  fi
}

# Paso 4. Aparte, en /opt/moodtable.new: un fallo aquí no deja nada a medias en /opt/moodtable.
# Un clon superficial: `git log -1` dice qué commit está instalado.
build_staging() {
  local ref=$1
  rm -rf "$STAGING_DIR"
  info "Clonando ${ref} en ${STAGING_DIR}"
  git clone --quiet --depth 1 --branch "$ref" "$REPO_URL" "$STAGING_DIR" </dev/null
  # Ahora, mientras el clon es de root: después git no lee un repositorio de otro usuario.
  installed_commit=$(git -C "$STAGING_DIR" log -1 --format='%h %s')

  info 'Instalando las dependencias (unos minutos)'
  (cd "$STAGING_DIR" && pnpm install --frozen-lockfile </dev/null)

  info 'Construyendo el panel'
  (cd "$STAGING_DIR" && pnpm --filter @moodtable/panel build </dev/null)
}

# Paso 5. La demo (tira virtual y fichero de audio de ejemplo) con server.host en 0.0.0.0, para
# que el panel se abra desde otro equipo de la red local. Lo hace node, que ya está instalado.
write_base_config() {
  info 'Dejando el fichero de configuración base (la demo)'
  (cd "$STAGING_DIR" && /usr/bin/node --input-type=module -e "
    import { readFileSync, writeFileSync } from 'node:fs';
    const config = JSON.parse(readFileSync('config/demo.json', 'utf8'));
    config.server = { ...config.server, host: '0.0.0.0' };
    writeFileSync('config/local.json', JSON.stringify(config, null, 2) + '\n');
  " </dev/null)
}

# Paso 5, al reinstalar. Con conservar, el fichero de la instalación existente pasa tal cual; con
# sobrescribir, el base, y el anterior se guarda al lado como .bck. data/ (el estado del
# instrumento) no se copia: empieza de cero.
write_config() {
  if [[ $config_choice == 'conservar' ]]; then
    info "Conservando el fichero de configuración de ${existing_dir}"
    cp "$(existing_config)" "${STAGING_DIR}/config/local.json"
    return
  fi
  write_base_config
  if [[ $config_choice == 'sobrescribir' && -f $(existing_config) ]]; then
    info "Guardando el fichero de configuración anterior como ${INSTALL_DIR}/config/local.json.bck"
    cp "$(existing_config)" "${STAGING_DIR}/config/local.json.bck"
  fi
}

# Paso 6. Toda la instalación es del usuario propio; las dependencias y el build se han hecho como
# root. El cambio es lo único que no se puede interrumpir sin consecuencias, y dura segundos: se
# para el servicio, la instalación del script se aparta a .old, la nueva ocupa su sitio y la
# apartada se borra. La anterior de la mesa (el clon) no se toca.
switch_install() {
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$STAGING_DIR"
  if service_is_registered; then
    info 'Parando el servicio'
    systemctl stop "$SERVICE"
  fi
  if [[ $existing_dir == "$INSTALL_DIR" ]]; then
    rm -rf "$RETIRED_DIR"
    mv "$INSTALL_DIR" "$RETIRED_DIR"
  fi
  info "Moviendo la instalación a ${INSTALL_DIR}"
  mv "$STAGING_DIR" "$INSTALL_DIR"
  rm -rf "$RETIRED_DIR"
}

# Paso 7. Si el servicio ya estaba registrado, `restart` lo arranca con la instalación nueva. La
# unidad se sustituye sin escribir a través de ella, por si fuera un enlace a la del clon.
register_service() {
  info 'Registrando el servicio para que arranque al encender la Pi'
  cp --remove-destination "${INSTALL_DIR}/deploy/${SERVICE}.service" "$UNIT_PATH"
  systemctl daemon-reload
  systemctl enable "$SERVICE"
  systemctl restart "$SERVICE"
}

print_panel_address() {
  local port ip
  port=$(cd "$INSTALL_DIR" && /usr/bin/node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    console.log(JSON.parse(readFileSync('config/local.json', 'utf8')).server?.port ?? 8080);
  " </dev/null)
  ip=$(hostname -I | awk '{ print $1 }')

  printf '\nInstalado en %s: %s\n' "$INSTALL_DIR" "$installed_commit"
  printf 'El panel, desde otro equipo de la red local: http://%s:%s\n' "${ip:-<ip de la Pi>}" "$port"
  printf 'Las tiras y la tarjeta de sonido se declaran en %s/config/local.json (con sudo),\n' "$INSTALL_DIR"
  printf 'y después: sudo systemctl restart %s\n' "$SERVICE"
  printf 'El registro del motor: journalctl -u %s -b\n' "$SERVICE"
}

print_reinstall_notes() {
  [[ -n $existing_dir ]] || return 0
  printf '\nEl estado del instrumento empieza de cero.\n'
  if [[ -f "${INSTALL_DIR}/config/local.json.bck" ]]; then
    printf 'El fichero de configuración anterior quedó en %s/config/local.json.bck\n' "$INSTALL_DIR"
  fi
  if [[ $existing_dir != "$INSTALL_DIR" ]]; then
    printf 'La instalación anterior sigue en %s, pero el servicio ya no la usa.\n' "$existing_dir"
    printf 'Para lanzar el motor desde ella, para antes el servicio: sudo systemctl stop %s\n' "$SERVICE"
  fi
}

# El commit instalado, para el mensaje final.
installed_commit=''

main() {
  local ref=${1:-main}
  require_root
  # Sin la pregunta de corepack al descargar la versión de pnpm de `packageManager`.
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  trap 'on_error $LINENO' ERR

  detect_existing
  if [[ -n $existing_dir ]]; then
    ask_config_choice
  fi
  install_system_packages
  ensure_service_user
  build_staging "$ref"
  write_config
  switch_install
  register_service
  print_panel_address
  print_reinstall_notes
}

main "$@"
