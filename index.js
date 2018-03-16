const url = require('url')
const fs = require('fs')
const request = require('request')
const { JSDOM } = require('jsdom')
const jquery = require('jquery')
const svg2png = require('svg2png')

function readSession() {
  return fs.readFileSync('./session', 'utf-8')
}

function getLeaderBoard(cookie) {
  const urls = [
    'https://wakatime.com/leaders/sec/%25E5%2585%2594%2526friends',
    'https://wakatime.com/leaders/sec/%25E5%2585%2594%2526moreFriends',
    'https://wakatime.com/leaders/sec/%25E5%2585%2594%2526friendsPlus'
  ]

  return Promise.all(urls.map(url => {
    return new Promise((resolve, reject) => {
      request({
        url,
        headers: {
          cookie
        }
      }, (err, _, data) => {
        if(err) {
          reject(err)
          return
        }

        resolve(data)
      })
    })
  }))
}

function getUsersData(datas) {
  return Promise.all(datas.map(data => {
    const { window } = new JSDOM(data)
    const $ = jquery(window)
    const $users = $('[class^="rank"]').not('.current-user')

    return $users.toArray().map(el => {
      const $el = $(el)
      const $user = $(el).find('td').eq(1)
      const name = $user.text().trim()
      const id = url.parse($user.find('a').attr('href')).pathname
      const avatar = $user.find('img').attr('src')
      const sum = $(el).find('td').eq(2).text().trim()
      const avg = $(el).find('td').eq(3).text().trim()

      return {
        name,
        id,
        avatar,
        sum,
        avg
      }
    })
  }))
}

function sortByPercent(a, b) {
  const { percent: pa } = a
  const { percent: pb } = b
  return pa - pb
}

function mapDataByName(prop) {
  return prop.sort(sortByPercent).map(({ name }) => name)
}

function getUsersDetails(cookie) {
  return users => {
    return Promise.all(users.map(user => {
      const { id } = user
      return new Promise((resolve, reject) => {
        request({
          url: `https://wakatime.com/api/v1/users/${id}/stats/last_7_days?timeout=15`,
          headers: {
            cookie
          }
        }, (err, res, body) => {
          if(err) {
            reject(err)
            return
          }

          const {
            languages,
            editors,
            operating_systems,
            daily_average,
            total_seconds
          } = JSON.parse(body).data

          user.langs = mapDataByName(languages)
          user.editors = mapDataByName(editors)
          user.oss = mapDataByName(operating_systems)
          resolve(user)
        })
      })
    }))
  }
}

function downloadAvatars(users) {
  return Promise.all(users.map(user => {
    const { avatar } = user
    return new Promise((resolve, reject) => {
      request({
        url: avatar,
        encoding: 'base64'
      }, (err, res, data) => {
        if(err) {
          reject(err)
          return
        }
        user.avatar = data
        resolve(user)
      })
    })
  }))
}

function render(users) {
  const wrapper = fs.readFileSync('./wrapper.svg', 'utf-8')
  const header = fs.readFileSync('./header.svg', 'utf-8')
  const items = users.map(({ id, name, avatar, sum, avg }, idx) => {
    return fs.readFileSync('./item.svg', 'utf-8')
      .replace(/{{Id}}/g, id)
      .replace(/{{Avatar}}/g, avatar)
      .replace(/{{Name}}/g, name)
      .replace(/{{Sum}}/g, sum)
      .replace(/{{Avg}}/g, avg)
      .replace(/{{Rank}}/g, idx + 1)
      .replace(/{{Height}}/g, String(idx * 45))
  })

  const headers = header.replace('{{Avatar}}', users[0].avatar)
  const svg = wrapper
        .replace(/{{Top}}/, headers)
        .replace(/{{List}}/g, items.join('\n'))

  return svg
}

function output(svg) {
  return svg2png(svg)
    .then(buffer => {
      fs.writeFileSync(`output.png`, buffer, 'utf-8')
    })
}


function main(main) {
  const session = readSession()
  Promise.resolve(session)
    .then(getLeaderBoard)
    .then(getUsersData)
    .then(getUsersDetails)
    .then(downloadAvatars)
    .then(render)
    .then(console.log)
    // .then(output)
}

main()
