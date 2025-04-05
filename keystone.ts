import dotenv from "dotenv";
import { config } from "@keystone-6/core";
import { TypeInfo } from ".keystone/types";
import { uploadFile, getUrl } from "./s3";
dotenv.config();
import * as Models from "./models";
import { withAuth, session } from "./auth";
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

export default withAuth(
  config<TypeInfo>({
    server: {
      port: 8080,
      cors: {
        origin: [
          "http://localhost:3000",
          "http://slop.entroponics.com.s3-website-us-east-1.amazonaws.com",
          "https://slop.entroponics.com"
        ],
      },
      maxFileSize: 200 * 1024 * 1024,

      //custom endpoint used to upload movie images to S3 bucket
      extendExpressApp: (app, commonContext) => {
        app.get("/api/movie/:movieKey", async (req, res) => {
          const { movieKey } = req.params;
          if (!movieKey) {
            return res.send(404);
          }
          try {
            const url = await getUrl({ key: movieKey });
            return res.json(url);
          } catch (e) {
            res
              .status(500)
              .send({ message: "Internal server error. Please try again" });
          }
        });
        app.post(
          "/api/movie",
          upload.single("movieImage"),
          async (req, res) => {
            const userId = req.body.userId;
            const context = await commonContext.withRequest(req, res);
            const fileData = {
              movieTitle: req.body.movieTitle,
              //@ts-ignore
              movieImage: req.file,
            };

            const userIsAuthorized = () => {
              return context.query.User.findOne({
                where: { id: userId },
              })
                .then((res) => {
                  if (res === null) {
                    return false;
                  } else {
                    return true;
                  }
                })
                .catch(console.error);
            };

            const authResult = await userIsAuthorized();

            if (authResult) {
              const s3upload = await uploadFile(fileData);
              res.json(s3upload);
            } else {
              res
                .status(401)
                .send({ message: "User does not have authorization" });
            }

            // - - ***** if we want this endpoint to be responsible for
            // - - ***** creating an entire slop, this might be where to start
            // const movie = await context.query.Movie.createOne({
            //   data: {
            //     title: 'movie title',
            //     author:  - - - etc
            //   },
            //   query: 'id name posts { id title }', //<== identifies what fields you want in response
            // });
          },
        );
      },
    },
    db: {
      provider: "mysql",
      url: `mysql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:6652/${process.env.DB_NAME}`,
      enableLogging: true,
      idField: { kind: "uuid" },
      useMigrations: true,
    },
    telemetry: false,
    graphql: {
      playground: true,
      apolloConfig: {
        introspection: true,
      },
    },
    storage: {
      my_S3_images: {
        kind: "s3",
        type: "image",
        bucketName: process.env.S3_BUCKET_NAME || "keystone-test",
        region: process.env.S3_REGION || "us-east-1",
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "keystone",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "keystone",
        signed: { expiry: 5000 },
        forcePathStyle: true,
      },
      my_S3_sounds: {
        kind: "s3",
        type: "file",
        bucketName: process.env.S3_BUCKET_NAME || "keystone-test",
        region: process.env.S3_REGION || "us-east-1",
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "keystone",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "keystone",
        signed: { expiry: 5000 },
        forcePathStyle: true,
      },
    },
    lists: Models,
    session,
  }),
);

//***********Images API
//If support for image fields is enabled in the system,
//then an images API will be made available on the context object.
//This API takes advantage of the following types:
// type ImageMode = 'local';

// type ImageExtension = 'jpg' | 'png' | 'webp' | 'gif';

// type ImageData = {
//   mode: ImageMode;
//   id: string;
//   extension: ImageExtension;
//   filesize: number;
//   width: number;
//   height: number;
// };
