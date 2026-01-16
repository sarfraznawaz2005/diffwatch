const blessed = require('neo-neo-blessed');

const blessedScreen = blessed.screen();
const box = blessed.box({
  parent: blessedScreen,
  top: 'center',
  left: 'center',
  width: '50%',
  height: 3,
  border: { type: 'line' }
});

const input = blessed.textbox({
  parent: box,
  top: 0,
  left: 0,
  width: '100%-2',
  height: 1,
  keys: true,
  inputOnFocus: true,
  style: { fg: 'white', bg: 'black' },
});

input.on('submit', () => {
  const val = input.value;
  blessedScreen.destroy();
  console.log(`Value: '${val}'`);
  console.log(`Length: ${val.length}`);
  console.log(`Includes newline: ${val.includes('\n')}`);
  process.exit(0);
});

input.focus();
blessedScreen.render();
