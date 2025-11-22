import { audioMap } from './constants'
import type { AudioCue } from './types'

const audioCache: Partial<Record<AudioCue, HTMLAudioElement>> = {}

export const playAudio = (cue: AudioCue) => {
  const src = audioMap[cue]
  if (!audioCache[cue]) {
    const audio = new Audio(src)
    audio.preload = 'auto'
    audioCache[cue] = audio
  }
  const audio = (audioCache[cue]?.cloneNode(true) as HTMLAudioElement) ?? new Audio(src)
  audio.preload = 'auto'
  audio.volume = 0.8
  audio.currentTime = 0
  audio.play().catch(() => {
    /* autoplay restrictions */
  })
}
