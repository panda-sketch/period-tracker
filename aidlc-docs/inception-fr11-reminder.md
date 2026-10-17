# Inception: FR-11 Upcoming period reminder

AI-DLC phase: **Inception approved** 2026-10-17. Thanh chose option A (calendar reminder plus in-app banner).
Date: 2026-10-17

## Request
"Send me a text notification when I'm 5 days out from my next period."

## Requirement (draft)
| ID | Requirement |
|----|-------------|
| FR-11 | Notify the owner 5 days before the predicted next period start. The reminder date follows the latest prediction (FR-4). |

User story US-12: As the owner, I get a reminder 5 days before my predicted period, so I can prepare. *Accept:* the reminder fires on predicted start minus 5 days, and its wording does not reveal what it is about to someone glancing at the lock screen.

## Conflict with NFR-1 (no third parties, zero network calls)
A **text message (SMS)** cannot be sent from the phone to itself by a web app. It needs:
1. A server that stores your phone number and next period date, and runs a daily job.
2. An SMS provider (e.g. Twilio) that receives the number and message text.
3. Your mobile carrier, which sees the message content.

That is three parties holding health-related data, which breaks the hard requirement this app was built around. It would also mean removing the network block (CSP) and running a server.

A **web push notification** has the same problem in a milder form: it needs a server plus Apple's or Google's push service.

A **scheduled local notification** from a web app is not possible today: browsers removed the API, and an installed web app on iPhone cannot run in the background.

## Options
| Option | How it works | Third parties | Reliability |
|--------|--------------|---------------|-------------|
| **A. Calendar reminder (recommended)** | App adds an event with an alert to your phone's calendar ("Reminder", neutral wording) on predicted start minus 5 days. The phone's own calendar shows the notification. A banner in the app also shows "Period in 5 days". | None if saved to an on-device calendar. If your default calendar syncs to iCloud or Google, that service stores the event title and date (wording kept neutral). | Fires even if the app is closed. Needs a tap to update when the prediction shifts; the app prompts you when it has. |
| B. In-app banner only | Banner on the Today screen from 5 days out. | None | Only seen when you open the app. |
| C. Real SMS | Server + SMS provider + carrier, as above. | 3 | Reliable, but breaks NFR-1. |

## Design notes for option A (if chosen)
- Settings: "Reminder N days before" (default 5), and "Add reminder to calendar" which saves an `.ics` file the phone opens in Calendar.
- Event: all-day on start minus 5, title "Reminder" (customisable), alert at 9:00. No health words in the title or notes.
- The app remembers which date it exported; when a new prediction moves it by a day or more, Today shows "Your reminder date changed. Update calendar."
- Still zero network calls; CSP unchanged.
