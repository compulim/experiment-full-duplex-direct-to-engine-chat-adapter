import { ReactWebChat } from 'botframework-webchat';
import { FullDuplexChatAdapterForDevelopmentOnly } from 'direct-to-engine-poc-chat-adapter';
import React, { Fragment, useMemo } from 'react';

const App = () => {
  const directLine = useMemo(
    () =>
      new FullDuplexChatAdapterForDevelopmentOnly('https://.../environments/.../bots/.../test/conversations', {
        DO_NOT_USE_THIS_FOR_PRODUCTION: true,
        token: 'eyJ...'
      }).toDirectLineJS(),
    []
  );

  return (
    <Fragment>
      <h1>Direct-to-Engine POC</h1>
      <ReactWebChat directLine={directLine} />
    </Fragment>
  );
};

export default App;
