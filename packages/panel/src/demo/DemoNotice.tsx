/**
 * TEMPORAL (MOO-181): el aviso que explica la demo pública a quien la abre sin haber leído el README,
 * pensado para la corrección del máster. Se retira después de la corrección: se borra esta carpeta y
 * su línea en `App.tsx`. Por eso no hay un campo en la configuración del motor que lo active: solo
 * sale con el dominio de la demo, así que en local, en la mesa y en los E2E no aparece.
 */
import { Anchor, AspectRatio, Button, Group, List, Modal, Stack, Text } from '@mantine/core';
import { useState } from 'react';

/** El dominio de la demo pública (README §2.4). */
export const DEMO_HOSTNAME = 'moodtable.josebaalonso.tech';

/** La clave con la que el navegador recuerda que ya se ha cerrado el aviso. */
export const DEMO_NOTICE_SEEN_KEY = 'moodtable.demoNoticeSeen';

const README_URL = 'https://github.com/7daysofrain/mood-table-v2#readme';

/**
 * El vídeo de la mesa (README §1.3), incrustado desde `youtube-nocookie.com`: YouTube no deja cookies hasta
 * que se reproduce, y no arranca solo.
 */
export const TABLE_VIDEO_EMBED_URL = 'https://www.youtube-nocookie.com/embed/SKcjWI1v5Rw?rel=0';

/** Lo que el aviso usa del almacenamiento del navegador: los tests le dan uno en memoria. */
export type NoticeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Si ya se ha cerrado en este navegador. Sin almacenamiento (una ventana privada que lo bloquea), el
 * aviso sale cada vez: es preferible a no explicar la demo.
 */
function alreadySeen(storage: NoticeStorage | undefined): boolean {
  try {
    return storage?.getItem(DEMO_NOTICE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberSeen(storage: NoticeStorage | undefined): void {
  try {
    storage?.setItem(DEMO_NOTICE_SEEN_KEY, '1');
  } catch {
    // Sin almacenamiento, el aviso volverá a salir la próxima vez.
  }
}

function browserStorage(): NoticeStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function DemoNotice({
  hostname = window.location.hostname,
  storage = browserStorage(),
}: Readonly<{ hostname?: string; storage?: NoticeStorage }>) {
  const [opened, setOpened] = useState(() => hostname === DEMO_HOSTNAME && !alreadySeen(storage));

  const close = () => {
    rememberSeen(storage);
    setOpened(false);
  };

  return (
    <Modal opened={opened} onClose={close} title="Mood Table · demo pública" size="lg" centered>
      <Stack gap="sm">
        <Text>
          Mood Table es un instrumento de luz para una mesa de DJ: un motor en TypeScript pinta tiras
          LED que reaccionan a la música, y este panel lo toca en directo.
        </Text>
        <Text>
          Aquí no hay hardware: las dos tiras del visor son virtuales y reaccionan a una pista de
          ejemplo. En la mesa, lo que ves en el visor lo pinta una tira LED real, como en este vídeo:
        </Text>
        <AspectRatio ratio={16 / 9}>
          <iframe
            src={TABLE_VIDEO_EMBED_URL}
            title="Vídeo de la Mood Table en la mesa"
            style={{ border: 0 }}
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </AspectRatio>
        <Text>Para probarlo:</Text>
        <List spacing={4}>
          <List.Item>pulsa el altavoz de la cabecera para oír la pista;</List.Item>
          <List.Item>en Efectos, cambia el efecto de la tira;</List.Item>
          <List.Item>en Intensidad, baja el fader: todas las tiras bajan a la vez;</List.Item>
          <List.Item>en Tiras, elige la otra tira.</List.Item>
        </List>
        <Text size="sm" c="dimmed">
          Todos los visitantes comparten el mismo estado, que vuelve al inicial cada 3 horas. Cómo
          está hecho, en el{' '}
          <Anchor href={README_URL} target="_blank" rel="noopener noreferrer">
            README del proyecto
          </Anchor>
          .
        </Text>
        <Group justify="flex-end">
          <Button onClick={close}>Entendido</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
