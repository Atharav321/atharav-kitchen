# Atharav Kitchen — Firestore Automated Backup Guide
**Version:** v1.0 | **Date:** August 2026

---

## Overview

Firestore mein data automatically back up hona chahiye taaki accidental deletion ya data corruption ke case mein recovery possible ho.

**Method:** Google Cloud Scheduled Exports (official Firebase/GCP feature)
**Cost:** Free tier mein included (small database ke liye negligible cost)
**Storage:** Google Cloud Storage bucket mein daily export

---

## Step 1 — Google Cloud Project Access

1. [console.cloud.google.com](https://console.cloud.google.com) kholo
2. Project select karo: **`atharav-kitchen-e587b`**
3. Left menu > **Firestore Database** > **Import/Export** tab

---

## Step 2 — Cloud Storage Bucket Banao (one-time)

1. Left menu > **Cloud Storage** > **Buckets**
2. **Create Bucket** click karo
3. Settings:
   ```
   Name:     atharav-kitchen-backups
   Region:   asia-south1 (Mumbai — data India mein rahega)
   Class:    Standard
   Access:   Uniform (recommended)
   ```
4. **Create** click karo

---

## Step 3 — Firestore Export Permission Dena

Firestore service account ko Storage bucket write access chahiye:

1. Left menu > **IAM & Admin** > **IAM**
2. Search karo: `service-405541916369@gcp-sa-firestore.iam.gserviceaccount.com`
3. Edit (pencil icon) > **Add role** > `Storage Admin`
4. Save

---

## Step 4 — Cloud Scheduler Setup (Automated Daily Backup)

1. Left menu > **Cloud Scheduler** > **Create Job**
2. Settings:
   ```
   Name:        firestore-daily-backup
   Region:      asia-south1
   Frequency:   0 2 * * *   (roz raat 2 baje — low traffic time)
   Timezone:    Asia/Kolkata
   Target:      HTTP
   URL:         https://firestore.googleapis.com/v1/projects/atharav-kitchen-e587b/databases/(default):exportDocuments
   HTTP method: POST
   Body:
   {
     "outputUriPrefix": "gs://atharav-kitchen-backups/daily/",
     "collectionIds": ["orders", "customers", "menu", "coupons", "wallets", "feedback", "riders", "settings"]
   }
   Auth header: Add OAuth token  
   Service account: App Engine default service account
   ```
3. **Create** click karo

---

## Step 5 — Retention Policy (Auto-delete old backups)

Purane backups delete karo taaki storage cost na badhe:

1. Cloud Storage > **`atharav-kitchen-backups`** bucket > **Lifecycle** tab
2. **Add rule**:
   ```
   Action:     Delete object
   Condition:  Age > 30 days
   ```
3. Save

> **Result:** Last 30 days ke backups hamesha available rahenge. Purane automatically delete.

---

## Step 6 — Backup Verify Karna (test)

Setup ke baad manually ek test export chalao:

```bash
# Google Cloud CLI se (ya Cloud Shell mein):
gcloud firestore export gs://atharav-kitchen-backups/manual-test/ \
  --project=atharav-kitchen-e587b \
  --collection-ids=orders,customers,menu
```

Cloud Storage bucket mein files dikhnee chahiye.

---

## Recovery (Restore kaise kare)

Agar kabhi data recover karna ho:

```bash
# Specific date ka backup restore karo:
gcloud firestore import gs://atharav-kitchen-backups/daily/2026-08-10T02:00:00/ \
  --project=atharav-kitchen-e587b \
  --collection-ids=orders   # sirf orders restore karne ke liye
```

> ⚠️ **Warning:** Import existing data ko overwrite kar deta hai. Production mein karte waqt careful raho.

---

## Monitoring — Backup Alerts

Agar backup fail ho toh email alert aaye:

1. Cloud Scheduler > `firestore-daily-backup` > **Edit**
2. **Retry config** > Max retries: 3
3. Cloud Monitoring > **Alerting** > Create Policy:
   - Metric: `cloud_scheduler/job/attempt_count` with status=failed
   - Notify: Email to `chotugupta7395@gmail.com`

---

## Quick Reference

| What | Where |
|------|-------|
| Backups stored | `gs://atharav-kitchen-backups/daily/` |
| Schedule | Daily at 2:00 AM IST |
| Retention | 30 days |
| Project ID | `atharav-kitchen-e587b` |
| Region | `asia-south1` (Mumbai) |
| Collections backed up | orders, customers, menu, coupons, wallets, feedback, riders, settings |

