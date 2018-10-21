/**
 * Author: Ruo
 * Create: 2018-08-20
 * Description: 我的关注 视频自动提送 功能
 */
import $ from 'jquery';
import _ from 'lodash';
import {Feature} from 'Modules';
import {PERMISSION_TYPE, getURL, __} from 'Utils';

const {login, notifications} = PERMISSION_TYPE;

export class DynamicCheck extends Feature {
    constructor() {
        super({
            name: 'dynamicCheck',
            kind: 'video',
            GUI: null,
            permissions: {login, notifications},
            options: {
                on: true,
                notify: true,
                optionType: 'checkbox',
                options: [
                    {title: '推送通知', key: 'notification', value: true},
                ],
            },
        });
        this.feedList = [];
        this.lastTime = Date.now();
    }

    launch = () => {
        chrome.alarms.onAlarm.addListener((alarm) => {
            switch (alarm.name) {
                case 'dynamicCheck':
                    this.checkUnread();
                    break;
            }
        });
        chrome.alarms.create('dynamicCheck', {periodInMinutes: 1});
        chrome.notifications.onButtonClicked.addListener(function(notificationId, index) {
            if (this.feedList[notificationId] && index === 0) {
                chrome.notifications.clear(notificationId);
                chrome.tabs.create({url: this.feedList[notificationId]});
            }
        });
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.commend === 'getDynamicList') sendResponse(this.feedList);
        });
        this.checkUnread();
    };

    // 检查未读推送
    checkUnread = () => {
        return $.get('https://api.bilibili.com/x/feed/unread/count?type=0', {}, (unreadRes) => {
            if (unreadRes.code === 0 && unreadRes.data.all > 0) {
                chrome.browserAction.setBadgeText({text: String(unreadRes.data.all)}); // 设置扩展菜单按钮上的Badge\（￣︶￣）/
                this.getFeed().then(() => this.options.notify && this.sendNotification());
            } else void this.getFeed();
        });
    };

    // 获取并存储推送数据 - 不缓存到本地(￣.￣)
    getFeed = async () => {
        return $.get('https://api.bilibili.com/x/feed/pull?ps=1&type=0', {}, (feedRes) => {
            const {code, data} = feedRes;
            if (code === 0 && data.feeds instanceof Array) { // 当返回数据正确(￣.￣)
                this.lastTime = Date.now();
                const list = _.filter(data.feeds, v => !~_.findIndex(this.feedList, {id: v.id}));
                this.feedList = list.concat(this.feedList).slice(0, 9);
            } else { // 请求出问题了！
                console.error(feedRes);
                chrome.browserAction.setBadgeText({text: 'error'});
            }
        });
    };

    // 弹出推送通知窗口
    sendNotification = () => {
        _.map(this.feedList, (feed) => {
            const {id: aid, addition, ctime} = feed;
            if (feed && ctime !== this.lastTime) { // 请求到不同时间，有新推送啦(～￣▽￣)～
                chrome.notifications.create('bilibili-helper-aid' + aid, {
                    type: 'basic',
                    iconUrl: getURL('/statics/imgs/cat.svg'),
                    title: __('notificationTitle'),
                    message: addition.title,
                    buttons: [{title: __('notificationWatch')}],
                }, (notificationId) => {
                    this.feedList[notificationId] = addition.link;
                });
            } else return; // 为什么检测过了呢Σ(oﾟдﾟoﾉ)
        });
    };
};