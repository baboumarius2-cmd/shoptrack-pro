export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');

  if (!code || !shop) {
    return new Response(
      'Paramètres manquants (code ou shop). Assure-toi de bien passer par le lien d\'installation fourni par Claude.',
      { status: 400 }
    );
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      'SHOPIFY_CLIENT_ID ou SHOPIFY_CLIENT_SECRET manquant dans les variables Vercel.',
      { status: 500 }
    );
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      return new Response(
        `<html><body style="font-family: sans-serif; padding: 40px; background:#111; color:#eee;">
          <h1>❌ Erreur</h1>
          <pre>${JSON.stringify(data, null, 2)}</pre>
        </body></html>`,
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new Response(
      `<html>
        <body style="font-family: sans-serif; padding: 40px; background:#111; color:#eee;">
          <h1>✅ Token récupéré avec succès !</h1>
          <p>Copie ce token en entier (clique dedans, Ctrl+A puis Ctrl+C) :</p>
          <textarea style="width:100%; height:100px; font-size:16px; padding:10px;" readonly onclick="this.select()">${data.access_token}</textarea>
          <p style="margin-top:20px;">Scopes accordés : ${data.scope}</p>
          <p style="color:#f88; margin-top:30px;">⚠️ Une fois copié, va dans Vercel et colle-le comme valeur de SHOPIFY_TOKEN, puis reviens vers Claude.</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err) {
    return new Response(`Erreur serveur : ${err.message}`, { status: 500 });
  }
}
