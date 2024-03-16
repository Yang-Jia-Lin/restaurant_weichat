const app = getApp()
const baseUrl = app.globalData.baseUrl

Page({
    data: {
        userInfo: app.globalData.userInfo,

        avatarUrl: app.globalData.userInfo.avatar_url,
        nickname: '微信用户',
        phone: '点击获取',
        isHavePhone: false
    },
    // 获取头像
    onChooseAvatar(e) {
        const {avatarUrl} = e.detail
        console.log(avatarUrl);
        this.setData({
            ['userInfo.avatarUrl']: avatarUrl,
        })
        this.setData({
            avatarUrl: e.detail,
        })

    },
    // 获取昵称
    onInput(e) {
        const value = e.detail.value;
        this.setData({
            nickname: value, // 更新页面数据
        });
        console.log('获取到昵称', this.data.nickname)
    },
    // 获取并解密手机号码
    getPhoneNumber(e) {
        if (e.detail.errMsg === 'getPhoneNumber:ok') {
            // 用户同意授权获取手机号，发送加密信息到后端解密
            wx.login({
                success: res => {
                    if (res.code) {
                        wx.request({
                            url: app.globalData.baseUrl+'users/phone', 
                            method: 'POST',
                            data: {
                                code: res.code, 
                                encryptedData: e.detail.encryptedData, 
                                iv: e.detail.iv // 加密算法的初始向量
                            },
                            success: (res) => {
                                if (res.data.success) {
                                    console.log('解密后的手机号码信息:', res.data.data);
                                    this.setData({
                                        phone: res.data.data.phoneNumber,
                                        isHavePhone: true
                                    })
                                } else {
                                    console.error('解密失败:', res.data.message);
                                }
                            },
                            fail: (error) => {
                                console.error('请求后端接口失败:', error);
                            }
                        });
                    } else {
                        console.error('登录失败！' + res.errMsg);
                    }
                }
            });
        } else {
            // 用户拒绝授权，处理逻辑
            console.error('用户拒绝授权获取手机号');
        }
    },


    // 注册
    getRegister() {
        let that = this
        wx.request({
            url: baseUrl + 'users/'+this.data.userInfo.user_id,
            method: 'PUT',
            data:{
                phone_number: that.data.phone
            },
            success: (res) => {
                if (res.statusCode === 200) {
                    console.log('注册成功', res.data);
                    app.globalData.isUserRegister = true
                    
                } else {
                    console.log('注册失败:', res.errMsg);
                }
            },
            fail: (err) => {
                console.error('请求服务器失败:', err);
            }
        });
    }
})