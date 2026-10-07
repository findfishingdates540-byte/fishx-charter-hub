<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Operator messaging uses a shared compact list-to-thread layout through 1024px so every persona behaves consistently on phones and tablets.
- Public browsing pages render one account-aware authenticated header whenever a session exists; anglers retain member links while operators retain their console links.
- Native iOS/Android apps are a Capacitor shell (`capacitor.config.ts`) loading the hosted site at `/welcome`; why: server functions and SSR must stay hosted, so no native-only code paths.
