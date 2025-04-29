// Global type declarations

interface Window {
  google: {
    accounts: {
      oauth2: {
        initTokenClient: (config: any) => {
          requestAccessToken: () => void;
        };
      };
    };
  };
}
