// The landing as plain HTML in index.html (vite.config.ts → staticHomePlugin): what a reader that
// runs no scripts gets. It is the same component rendered at build time, so the test checks what
// such a reader needs from it — the text is in the markup, folded parts included, and the links are real.

import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LandingScreen from '../LandingScreen'
import { STATIC_HOME_MARK } from '../../staticHome'
import index from '../../../index.html?raw'

const html = renderToStaticMarkup(<LandingScreen />)

describe('the landing as plain HTML', () => {
  it('index.html has the place for it, next to the app root, and no script-only stub', () => {
    expect(index).toContain(`<div id="static-home">${STATIC_HOME_MARK}</div>`)
    expect(index).toContain('#root:empty{min-height:100dvh}')
    expect(index).not.toContain('необходим JavaScript')
  })

  it('has one h1 and the text of every part, folded ones too', () => {
    expect(html.match(/<h1/g)).toHaveLength(1)
    for (const text of [
      'грузинского языка',
      'Для кого этот курс',
      'Программа A0 → B2',
      'Глаголы движения',
      'Продвинутая грамматика',
      'Часто спрашивают',
      'Первые 30 дней — полный доступ ко всему контенту бесплатно.'
    ]) {
      expect(html).toContain(text)
    }
  })

  it('links to every section of the site and to the bot', () => {
    for (const href of ['/verbs/', '/phrases/', '/words/', '/grammar/', '/learn/georgian/', 'https://t.me/trale_bot?start=site']) {
      expect(html).toContain(`href="${href}"`)
    }
  })
})
