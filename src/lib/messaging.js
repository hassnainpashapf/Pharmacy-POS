// WhatsApp, SIM SMS and Email for the Pharmacy POS — through the business's shared account at the hub (see @optix/suite-sdk).
import { createMessaging } from '@optix/suite-sdk'
import { hub } from './central'

const messaging = createMessaging(hub)

export const hasMessaging = messaging.isAvailable
export const messagingStatus = messaging.status
export const sendWhatsApp = messaging.sendWhatsApp
export const sendSms = messaging.sendSms
export const sendEmail = messaging.sendEmail
