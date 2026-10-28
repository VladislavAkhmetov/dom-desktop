import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { ApprovedPaths } = require('../electron/approved-paths.cjs')

describe('одобренные пути для запуска и чтения файлов', () => {
  it('открывает только пути, пришедшие через главный процесс, и помнит их между запусками', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-approved-'))
    try {
      const doc = path.join(directory, 'Макет.psd')
      const approved = new ApprovedPaths(directory)
      expect(approved.has(doc)).toBe(false)
      approved.approve(doc)
      expect(approved.has(doc)).toBe(true)
      expect(approved.has('relative/path.exe')).toBe(false)
      expect(approved.has(path.join(directory, 'other.exe'))).toBe(false)
      expect(new ApprovedPaths(directory).has(doc)).toBe(true)
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
  })

  it('один раз принимает ресурсы, сохранённые до появления списка, и не принимает новые из состояния', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-approved-'))
    try {
      const old = path.join(directory, 'old.docx'), app = path.join(directory, 'app.exe'), injected = path.join(directory, 'evil.exe')
      const state = { spaces: [{ resources: [{ kind: 'file', target: old }, { kind: 'app', target: app }, { kind: 'link', target: 'https://example.com' }] }] }
      const approved = new ApprovedPaths(directory)
      approved.adopt(state)
      expect(approved.has(old) && approved.has(app)).toBe(true)
      state.spaces[0].resources.push({ kind: 'app', target: injected })
      new ApprovedPaths(directory).adopt(state)
      expect(new ApprovedPaths(directory).has(injected)).toBe(false)
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
  })

  it('на Windows сравнивает пути без учёта регистра', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-approved-'))
    try {
      const approved = new ApprovedPaths(directory, 'win32')
      const file = path.join(directory, 'Report.XLSX')
      approved.approve(file)
      expect(approved.has(file.toLowerCase())).toBe(true)
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
  })
})
