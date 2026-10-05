import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

// Одноразовые подсказки интерфейса хранит сервер, а в мини-аппе — их копия в памяти: каждый тест
// начинает с чистого листа, как новый человек.
// Импорт — внутри, а не сверху файла: иначе модуль подсказок загрузится раньше, чем тест подменит api.
beforeEach(async () => (await import('./verbs/ui/hints')).resetSeenHints())
