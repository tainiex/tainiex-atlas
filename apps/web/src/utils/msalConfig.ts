import { Configuration, PopupRequest, PublicClientApplication } from '@azure/msal-browser';

export const msalConfig: Configuration = {
    auth: {
        clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'}`,
        redirectUri: window.location.origin + '/login',
    },
    cache: {
        cacheLocation: 'sessionStorage', // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
};

export const loginRequest: PopupRequest = {
    scopes: ['User.Read', 'email', 'openid', 'profile'],
};

// Check if Web Crypto API is available (required for MSAL)
function isCryptoAvailable(): boolean {
    return (
        typeof window !== 'undefined' &&
        window.crypto !== undefined &&
        window.crypto.subtle !== undefined
    );
}

// Lazy instance holder
let msalInstance: PublicClientApplication | null = null;

// Initialize MSAL only when crypto is available
function initializeMsal(): PublicClientApplication {
    if (!isCryptoAvailable()) {
        throw new Error('MSAL requires secure context (HTTPS or localhost)');
    }
    if (!msalInstance) {
        msalInstance = new PublicClientApplication(msalConfig);
    }
    return msalInstance;
}

// Safe getter with error handling
export function getMsalInstance(): PublicClientApplication | null {
    try {
        return initializeMsal();
    } catch (error) {
        console.warn('MSAL initialization failed:', error);
        return null;
    }
}
