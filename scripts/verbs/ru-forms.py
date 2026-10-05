#!/usr/bin/env python3
"""Русские формы для переводов глаголов → scripts/verbs/ru-forms.json.

Из них build-catalog.mjs собирает фразы «я хочу», «ты хотел(а)», «мы будем писать» — то, чем в упражнениях
объясняется грузинская форма вместо названия времени. Формы порождает pymorphy3, результат лежит в git
и вычитывается глазами: запускать нужно только когда меняется ru.json.

    pip install pymorphy3
    python3 scripts/verbs/ru-forms.py            # переписать ru-forms.json
    python3 scripts/verbs/ru-forms.py --check    # ничего не писать; код 1, если файл в git устарел

Что спрягается: первый глагол перевода. Пояснение в скобках и второй синоним отбрасываются
(«идти, уходить» → идти, «снимать (одежду)» → снимать). Всё, что так не получается — составные
переводы, «быть», глаголы, где по-русски говорят иначе («у меня есть») — задаётся руками в
ru-forms.overrides.json (поле why — зачем). Скрипт падает, если глагол не удалось проспрягать:
молча пропущенный перевод дал бы упражнение без русского текста.
"""
import json
import re
import sys
from pathlib import Path

import pymorphy3

HERE = Path(__file__).parent
PERSONS = [('1per', 'sing'), ('2per', 'sing'), ('3per', 'sing'), ('1per', 'plur'), ('2per', 'plur'), ('3per', 'plur')]
morph = pymorphy3.MorphAnalyzer()


def first_verb(gloss: str) -> tuple[str, str]:
    """Первый глагол перевода и то, что стоит после него в том же варианте («следовать за» → за)."""
    variant = re.sub(r'\([^)]*\)', '', gloss).split(',')[0].strip()
    word, _, rest = variant.partition(' ')
    return word, rest.strip()


def conjugate(infinitive: str) -> dict:
    parses = [p for p in morph.parse(infinitive) if 'INFN' in p.tag and p.normal_form == infinitive]
    if not parses:
        raise ValueError(f'pymorphy3 не знает инфинитива «{infinitive}»')
    # Двувидовые («финансировать») берём как несовершенные: у них есть настоящее время.
    parse = next((p for p in parses if p.tag.aspect == 'impf'), parses[0])
    aspect = parse.tag.aspect

    def form(*grammemes: str) -> str:
        inflected = parse.inflect(set(grammemes))
        if not inflected:
            raise ValueError(f'«{infinitive}»: нет формы {grammemes}')
        return inflected.word

    personal = [form(person, number) for person, number in PERSONS]
    result = {
        'inf': infinitive,
        'aspect': aspect,
        'past': {'m': form('past', 'masc', 'sing'), 'f': form('past', 'femn', 'sing'), 'pl': form('past', 'plur')},
    }
    # У совершенного вида личные формы — это будущее («скажу»), настоящего нет.
    result['future' if aspect == 'perf' else 'present'] = personal
    return result


def build() -> tuple[dict, list[str]]:
    glosses = json.loads((HERE / 'ru.json').read_text(encoding='utf-8'))
    overrides = json.loads((HERE / 'ru-forms.overrides.json').read_text(encoding='utf-8'))
    out, problems = {}, []
    for lemma in overrides:
        if lemma not in glosses:
            problems.append(f'ru-forms.overrides.json: {lemma} нет в ru.json')
    for lemma, gloss in glosses.items():
        override = overrides.get(lemma, {})
        infinitive, rest = first_verb(gloss)
        entry = {'ru': gloss}
        try:
            if 'phrases' in override:
                entry['phrases'] = override['phrases']
            else:
                entry.update(conjugate(override.get('inf', infinitive)))
                for key in ('present', 'future'):
                    if key in override:
                        entry[key] = override[key]
                tail = override.get('tail', '' if 'inf' in override else rest)
                if rest and 'tail' not in override and 'inf' not in override:
                    problems.append(f'{lemma}: «{gloss}» — перевод из нескольких слов, нужен tail или phrases в ru-forms.overrides.json')
                if tail:
                    entry['tail'] = tail
            if override:
                entry['override'] = override['why']
        except ValueError as error:
            problems.append(f'{lemma}: «{gloss}» — {error}')
            continue
        out[lemma] = entry
    return out, problems


def dump(forms: dict) -> str:
    lines = [f' {json.dumps(lemma, ensure_ascii=False)}: {json.dumps(entry, ensure_ascii=False)}' for lemma, entry in forms.items()]
    return '{\n' + ',\n'.join(lines) + '\n}\n'


def main() -> int:
    forms, problems = build()
    if problems:
        print('Русские формы не собраны:\n' + '\n'.join(f' ✗ {p}' for p in problems), file=sys.stderr)
        return 1
    text = dump(forms)
    target = HERE / 'ru-forms.json'
    if '--check' in sys.argv:
        if not target.exists() or target.read_text(encoding='utf-8') != text:
            print('ru-forms.json устарел: запусти python3 scripts/verbs/ru-forms.py', file=sys.stderr)
            return 1
        return 0
    target.write_text(text, encoding='utf-8')
    perfective = [f'{lemma} ({e["inf"]})' for lemma, e in forms.items() if e.get('aspect') == 'perf']
    print(f'→ {target}: {len(forms)} глаголов; совершенного вида: {", ".join(perfective) or "нет"}; '
          f'правок руками: {sum(1 for e in forms.values() if "override" in e)}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
