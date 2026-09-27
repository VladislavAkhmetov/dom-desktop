import type { AppState, MailMessage } from './types'

export function mailIsImportant(state: AppState, message: MailMessage): boolean {
  return Boolean((message.gmailImportant ?? message.important) || state.mailAccounts?.find(account => account.id === message.accountId)?.importantSenders?.some(sender => sender.trim() && message.from.toLowerCase().includes(sender.toLowerCase())))
}
