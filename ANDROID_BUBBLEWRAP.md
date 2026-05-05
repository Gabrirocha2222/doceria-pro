# Android via Bubblewrap/TWA

Este projeto Next.js pode ser empacotado como Android usando Bubblewrap e Trusted Web Activity (TWA). A URL publica usada pelo Bubblewrap e:

```bash
https://doceria-pro.vercel.app
```

## Checklist PWA

- `public/manifest.json` existe.
- `start_url` esta definido como `/dashboard`.
- `scope` esta definido como `/`.
- `display` esta definido como `standalone`.
- `theme_color` esta definido como `#C0392B`.
- `background_color` esta definido como `#FAF6F0`.
- `icons` inclui `/icons/icon-192.png` e `/icons/icon-512.png`.
- `src/app/layout.tsx` publica `<link rel="manifest" href="/manifest.json">`.
- `src/proxy.ts` nao intercepta `/manifest.json`, para que o Bubblewrap consiga ler o manifest sem login.

Depois de publicar na Vercel, confirme:

```bash
curl -I https://doceria-pro.vercel.app/manifest.json
curl https://doceria-pro.vercel.app/manifest.json
```

O retorno precisa ser JSON do manifest, nao HTML da tela de login.

## Comandos Bubblewrap

Instale a CLI:

```bash
npm i -g @bubblewrap/cli
```

Inicie o projeto Android/TWA:

```bash
bubblewrap init --manifest https://doceria-pro.vercel.app/manifest.json
```

Opcionalmente, para manter o projeto Android em uma pasta separada:

```bash
bubblewrap init --manifest https://doceria-pro.vercel.app/manifest.json --directory android-twa
cd android-twa
```

Gere os artefatos:

```bash
bubblewrap build
```

O Bubblewrap pode pedir Java/JDK, Android SDK, pacote Android, versao do app e dados de keystore. Guarde a keystore e suas senhas fora do Git.

## Saida esperada

No diretorio onde o Bubblewrap foi inicializado, o build normalmente gera:

- `app-release-signed.apk`: APK assinado para instalar e testar em aparelho Android.
- `app-release-bundle.aab`: Android App Bundle para envio ao Google Play Console.

## Assinatura e instalacao

1. Escolha um `package_name` permanente, por exemplo `br.com.doceriapro.app` se esse dominio for seu.
2. Crie ou informe uma keystore durante o fluxo do Bubblewrap.
3. Gere/verifique o SHA-256 da chave de assinatura.
4. Publique `public/.well-known/assetlinks.json` com o `package_name` e o SHA-256 correto. Para Play Store com Play App Signing, use o SHA-256 da chave de assinatura do Google Play, nao apenas a upload key local.
5. Refaca deploy na Vercel e valide `https://doceria-pro.vercel.app/.well-known/assetlinks.json`.
6. Instale para teste com:

```bash
bubblewrap install
```

ou:

```bash
adb install app-release-signed.apk
```

O `.aab` e destinado ao Play Console; para teste local, use o APK.
