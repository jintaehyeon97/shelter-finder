import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import storesRouter from './routes/stores';
import sheltersRouter from './routes/shelters';
import directionsRouter from './routes/directions';
import weatherRouter from './routes/weather';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/stores', storesRouter);
app.use('/shelters', sheltersRouter);
app.use('/directions', directionsRouter);
app.use('/weather', weatherRouter);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버 실행 중: http://0.0.0.0:${PORT}`);
  console.log('(폰에서 접속 시 PC의 로컬 IP를 사용하세요. 예: http://192.168.0.5:' + PORT + ')');
});
