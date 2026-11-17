export interface GoogleVerifiedProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

export function isGoogleOAuthConfigured(): boolean {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return Boolean(clientId && clientSecret);
}

export function buildGoogleAuthorizationUrl(params: {
  redirectUri: string;
  state: string;
  loginHint?: string;
  prompt?: 'select_account' | 'select_account consent';
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured.');
  }

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: params.state,
    access_type: 'online',
    prompt: params.prompt || 'select_account',
  });

  const hint = params.loginHint?.trim().toLowerCase();
  if (hint && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint)) {
    query.set('login_hint', hint);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

export async function exchangeGoogleAuthCode(params: {
  code: string;
  redirectUri: string;
}): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured.');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description || tokenData.error || 'Failed to exchange Google authorization code.'
    );
  }

  return tokenData.access_token;
}

export async function fetchVerifiedGoogleProfile(
  accessToken: string
): Promise<GoogleVerifiedProfile> {
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileResponse.ok) {
    throw new Error('Unable to retrieve verified Google profile.');
  }

  const data = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!data.sub || !data.email || data.email_verified !== true) {
    throw new Error('Google account must have a verified email address.');
  }

  return {
    sub: data.sub,
    email: data.email.trim().toLowerCase(),
    name: (data.name || data.email.split('@')[0]).trim(),
    picture: data.picture,
    emailVerified: true,
  };
}
