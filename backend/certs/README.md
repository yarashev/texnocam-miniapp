# Supabase CA certificate

Public root certificate, not a private key or credential.

Downloaded via HTTPS from the production URL used by Supabase Studio:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

The official Studio configuration providing that URL is:
https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json

SHA-256 fingerprint:
80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA

Subject: Supabase Root 2021 CA
Valid until: 2031-04-26 10:56:53 UTC
Retrieved: 2026-10-26

postgres-tls.js adds this trust anchor only for Supabase database/pooler hostnames. TLS still checks the server certificate chain and exact hostname. PGSSLROOTCERT overrides the bundled trust configuration when supplied. Rotate this certificate according to Supabase's official configuration before expiry or if Supabase rotates its CA.
