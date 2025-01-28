import { ReactWebChat } from 'botframework-webchat';
import { FullDuplexChatAdapter } from 'direct-to-engine-poc-chat-adapter';
import React, { Fragment, useMemo } from 'react';

const App = () => {
  const directLine = useMemo(() => new FullDuplexChatAdapter('http://localhost:8001/subscribe').toDirectLineJS(), []);

  return (
    <Fragment>
      <h1>Direct-to-Engine POC</h1>
      <ReactWebChat directLine={directLine} />
    </Fragment>
  );
};

export default App;
