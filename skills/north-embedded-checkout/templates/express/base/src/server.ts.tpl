import express from 'express';
import { northRouter } from './north/router';

const app = express();

// North routes first: the webhook needs raw bytes, so no global JSON parser above this line.
app.use(northRouter);
app.use(express.static('public'));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
