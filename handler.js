'use strict';
const request = require('sync-request');
const simpleParser = require('mailparser').simpleParser;
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const bucketName = 'cheap-flight-receiver';

const SLACK_URL = process.env.SLACK_URL;

module.exports.newCheapFlight = async (event, context, callback) => {

  const sesNotification = event.Records[0].ses;

  try {
    const email = await getEmailFromS3(sesNotification, callback);
    const parsed = await simpleParser(email.Body);
    sendToSlack(parsed);
  } catch (err) {
    console.log(err);
    callback(err);
  }

  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
    },
    body: JSON.stringify({
      message: 'DONE!'
    })
  };

  callback(null, response);
};

const sendToSlack = (parsed) => {

  // lots of formatting here, I suck at regex so if someone else wants to take a stab go for it
  const fromRegex = /<p style="padding: 0 !important; margin: 0 !important; margin-bottom: 0 !important;"> (.*?) <\/p> /g

  const imageTag = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig
  const destinationImage = html.match(imageTag).find(l => l.includes('cloudfront.net/deals'));

  const from = html.match(fromRegex);

  const cities = from.map(f =>  f.replace('<p style="padding: 0 !important; margin: 0 !important; margin-bottom: 0 !important;">', '').replace('</p>', '').replace(/<strong (.*?)>/, '').replace('</strong>', ''));
  
  const formattedSubject = parsed.subject.replace('Fwd: ', '');
  
  let formattedCities = cities.map(f => (f.startsWith('  TO:') || f.startsWith('FROM:')) ? `*${f.replace(/\s/g, '')}*` : `>${f}`);

  if (formattedCities[formattedCities.length - 1].startsWith('>*')) {
    formattedCities[formattedCities.length - 1] = formattedCities[formattedCities.length - 1].substr(1);
  }
  
  formattedCities = formattedCities.join('\r\n');

  const data = {
    text: formattedSubject,
    blocks: [
      {
          type: 'section',
          text: {
              type: 'plain_text',
              emoji: true,
              text: formattedSubject
          }
      },
      {
          type: 'divider'
      },
      {
          type: 'section',
          text: {
              type: 'mrkdwn',
              text: formattedCities
          },
          accessory: {
            type: 'image',
            image_url: destinationImage,
            alt_text: formattedSubject
          }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Built by <https://github.com/timjohnson|tim> :nerd_face:'
          }
        ]
      }
    ]
  }

  const resp = request('POST', SLACK_URL, {
    json: data
  });

  resp.getBody();
}

const getEmailFromS3 = async (sesNotification) => {
  const response = await s3.getObject({Bucket: bucketName, Key: sesNotification.mail.messageId}, (err) => {
    console.log('error: ', err);
  }).promise();
  return response;
}
