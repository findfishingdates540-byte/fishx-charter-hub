# Make home search return public results

## Changes
- Send every home category to its matching public directory, including the entered search term and location.
- Add keyword filtering to public directories across business name, description, category, city, region, and country.
- Keep these result pages accessible to signed-out visitors and preserve the authenticated header for signed-in users.
- Show all matching live businesses rather than an empty trip-only page when operators have no published trip package.

## Validation
- Test category, keyword, and location searches while signed out.
- Confirm the result pages compile and remain compatible with signed-in navigation.
