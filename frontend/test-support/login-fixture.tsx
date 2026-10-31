// UI/GIS mock only. No token, Google network or backend request is used here.
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { LoginLayout } from '../src/features/auth/LoginLayout';
import { LoginPresentation } from '../src/features/auth/LoginPresentation';
import { GoogleIdentityButton } from '../src/features/auth/GoogleIdentityButton';
import '../src/styles/index.css';
const sdk = { initializations: 0, renders: [], callback: null, clicks: 0 };
window.google = {
  accounts: {
    id: {
      initialize(options) {
        sdk.initializations++;
        sdk.callback = options.callback;
      },
      renderButton(parent, options) {
        sdk.renders.push(options.width);
        const b = document.createElement('button');
        b.textContent = 'GIS MOCK — kiểm thử';
        b.style.width = options.width + 'px';
        b.onclick = () => sdk.clicks++;
        parent.append(b);
      },
    },
  },
};
function Fixture() {
  const [scenario, setScenario] = useState('default');
  const [disabled, setDisabled] = useState(false);
  const onCredential = useCallback(() => {
    throw Error('Fixture must not receive credentials');
  }, []);
  window.loginFixture = { setScenario, setDisabled, sdk };
  return (
    <MemoryRouter>
      <LoginLayout>
        <LoginPresentation
          googleButton={
            <GoogleIdentityButton
              onCredential={onCredential}
              disabled={disabled}
              width={270}
            />
          }
          restoring={scenario === 'restoring'}
          submitting={scenario === 'loading'}
          error={
            scenario === 'error'
              ? 'Không thể đăng nhập UniHub. ' +
                'Thông báo thử nghiệm dài để kiểm tra bố cục. '.repeat(15)
              : null
          }
          authError={
            scenario === 'unavailable'
              ? 'Dịch vụ xác thực tạm thời chưa sẵn sàng. Bạn có thể thử lại.'
              : null
          }
        />
        <p
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            fontSize: 10,
            background: 'white',
          }}
        >
          MOCK UI/GIS — không gọi Google/API/database
        </p>
      </LoginLayout>
    </MemoryRouter>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
