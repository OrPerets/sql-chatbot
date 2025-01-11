const environment = 'dev';

const config = {
  dev: {
    serverUrl: 'http://127.0.0.1:5555',
  },
  prod: {
    serverUrl: "https://mentor-server-theta.vercel.app",
  },
};

export default config[environment];