# Consumer PWA boundary

This directory is reserved exclusively for the consumer application under
`/app`. A later PWA phase can add its manifest, service worker registration,
install prompt, offline page, consumer icons, update handling, notification
adapter, and deep-link adapter here.

Admin and hospital layouts must not import this module. Future caching should
be limited to immutable application assets and explicitly public discovery
data. Authentication responses, user profiles, bookings, notifications, and
other personal information must remain network-only and must never be placed
in a service-worker cache.

No service worker or install prompt is registered during this foundation phase.
