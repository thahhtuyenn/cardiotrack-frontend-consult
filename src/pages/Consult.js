import React, { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faPaperclip, faXmark } from "@fortawesome/free-solid-svg-icons";
import LightGallery from 'lightgallery/react';
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';
import 'lightgallery/css/lg-thumbnail.css';
import lgZoom from 'lightgallery/plugins/zoom';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgVideo from "lightgallery/plugins/video";


const initialMessages = {
    "sender": {
        "id": 0,
        "username": ""
    },
    "receiver": {
        "id": 0,
        "username": ""
    },
    "content": "",
}

export default function Consult() {

    const [users, setUsers] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [stompClient, setStompClient] = useState(null);
    const [messageSend, setMessageSend] = useState(false);
    const [messageList, setMessageList] = useState([]);
    const [usersOnline, setUsersOnline] = useState([]);
    const [noReadMessage, setNoReadMessage] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const imageInputRef = useRef(null);

    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messageList]);

    const getInfoNewUser = async (userId) => {
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/chat/api/v1/messages/${userId}`);
            return response.data;
        } catch (error) {
            console.error("Lỗi lấy thông tin user", error);
        }
    };

    useEffect(() => {
        const getUserList = async () => {
            try {
                const res = await axios.get(`${process.env.REACT_APP_API_URL}/chat/api/v1/messages`);

                return res.data;
            } catch (error) {
                console.error("Lỗi khi tải danh sách user", error);
            }
        }

        getUserList().then((data) => {
            setUsers(data);
        });
    }, [usersOnline, noReadMessage, messageList]);

    useEffect(() => {
        // Kết nối WebSocket
        const socket = new SockJS(`${process.env.REACT_APP_API_URL}/chat/api/v1/chat/ws`);
        const client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            onConnect: () => {
                console.log("WebSocket Connected");

                // Subscribe để nhận tin nhắn mới
                client.subscribe("/topic/messages", (msg) => {
                    const receivedMessage = JSON.parse(msg.body);

                    if (selectedUser && receivedMessage.senderId === selectedUser.id) {
                        setMessageList(prev => [...prev, JSON.parse(msg.body)]);
                    }
                    else {
                        const userExists = users.find((u) => u.id === receivedMessage.senderId);
                        if (userExists === null) {
                            const newUser = getInfoNewUser(receivedMessage.senderId);
                            setUsers([...users, newUser]);
                        }
                        setNoReadMessage(prev => [...prev, receivedMessage.senderId]);
                    }
                    // setMessageList(prev => [...prev, JSON.parse(msg.body)]);
                });

                // Subscribe to online users list topic (danh sách người dùng)
                client.subscribe(`/topic/online-users`, (msg) => {
                    console.log("👥 Online users:", msg.body);
                    setUsersOnline(JSON.parse(msg.body));
                });

            },
            onStompError: (frame) => {
                console.error("❌ STOMP Error:", frame.headers['message']);
            },

            onWebSocketError: (error) => {
                console.error("🚨 WebSocket Error:", error);
            },

            onDisconnect: () => {
                console.log("🔴 WebSocket disconnected!");
            },
            onDisconnect: () => console.log("Disconnected"),
        });
        client.activate();
        setStompClient(client);

        return () => client.deactivate();
    }, [selectedUser]);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'video/mp4'];
        if (!allowedTypes.includes(file.type)) {
            alert('Chỉ chấp nhận file ảnh (PNG, JPEG, GIF, MP4)');
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/chat/api/v1/s3/upload-image`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            const image = response.data;
            const newMessageObj = {
                sender: {
                    id: 0,
                },
                receiver: {
                    id: selectedUser.id,
                    username: selectedUser.fullName,
                },
                imageUrl: image,
                timestamp: new Date().toISOString()
            };

            if (!stompClient || !stompClient.connected) {
                console.error("🚨 Không thể gửi tin nhắn! WebSocket chưa kết nối.");
                return;
            }

            setSelectedUser({ ...selectedUser, messages: [...selectedUser.messages, newMessageObj] });
            setMessageList([...messageList, newMessageObj]);

            stompClient.publish({
                destination: "/app/chat",
                body: JSON.stringify(newMessageObj)
            });

        } catch (error) {
            console.error("❌ Upload failed:", error);
            alert("Lỗi upload");
        }
    };

    const sendMessage = () => {
        if (!newMessage.trim() || !stompClient || !stompClient.connected) {
            console.error("🚨 Không thể gửi tin nhắn! WebSocket chưa kết nối.");
            return;
        }

        const newMessageObj = {
            sender: {
                id: 0,
            },
            receiver: {
                id: selectedUser.id,
                username: selectedUser.fullName,
            },
            content: newMessage,
            timestamp: new Date().toISOString()
        };
        setSelectedUser({ ...selectedUser, messages: [...selectedUser.messages, newMessageObj] });
        setMessageList([...messageList, newMessageObj]);

        stompClient.publish({
            destination: "/app/chat",
            body: JSON.stringify(newMessageObj)
        });
        setNewMessage("");
    }

    const fileInputRef = useRef(null);

    const handleAttachClick = () => {
        fileInputRef.current.click(); // Kích hoạt input file khi nhấn vào button
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            console.log("File đã chọn:", file.name);
        }
    };

    useEffect(() => {
    }, [selectedUser]);

    const handleClickUser = (user) => {
        setMessageList(user.messages);
        setSelectedUser(user);
        setNoReadMessage(prev => prev.filter((id) => id !== user.id));
    }

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            {/* Header */}
            <div className="fixed top-0 left-0 w-full bg-blue-600 text-white p-4 font-bold flex items-center justify-between shadow-lg z-50">
                <div className="flex items-center space-x-2">
                    <img src="../../assets/img/logo.png" />
                    <span>TƯ VẤN KHÁCH HÀNG</span>
                </div>

                <div>
                    <button>
                        <FontAwesomeIcon icon={faXmark} size="lg" className="text-white" />
                    </button>
                </div>
            </div>
            {/* Main Chat Section */}
            {/* Main Content */}

            {
                users && (
                    <div className="flex flex-1 mt-[80px] h-[calc(100vh-80px)]">
                        {/* Danh sách user */}
                        <div className="w-1/4 bg-white border-r p-4 overflow-y-auto h-full">
                            {users.map((u, index) => (
                                <button className="w-full" key={index} onClick={() => handleClickUser(u)}>
                                    <div className={`${u.id === selectedUser?.id ? "bg-blue-300" : "bg-gray-200"} rounded-lg m-2 h-[55px] pl-2 pr-2 flex flex-col justify-center`}>
                                        <div className={`justify-between items-center flex`}>
                                            <div className="flex items-center">
                                                {usersOnline.includes(u.id) && (
                                                    <div className="w-[10px] h-[10px] bg-green-500 rounded-full"></div>
                                                )}
                                                <span className="ml-5">{u.username}</span>
                                            </div>
                                            {noReadMessage.includes(u.id) && (
                                                <div className="w-[10px] h-[10px] bg-red-500 rounded-full"></div>
                                            )}
                                        </div>
                                        <div className="flex items-center text-gray-400 pl-5 pr-3 text-sm">
                                            {
                                                u.messages && u.messages[u.messages.length - 1].senderId === 0 && (
                                                    <span>Bạn: </span>

                                                )
                                            }
                                            {
                                                u.messages && (
                                                    <span className={`${u.messages[u.messages.length - 1].senderId === 0 ? "pl-2" : "pl-0"} w-full truncate text-start`}>{u.messages[u.messages.length - 1].content ? u.messages[u.messages.length - 1].content : '[Hình ảnh]'}</span>
                                                )
                                            }
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Khung chat */}
                        <div className="w-3/4 flex flex-col bg-gray-50 h-full">
                            {/* Tin nhắn */}
                            <div className="flex-1 flex flex-col space-y-2 overflow-y-auto p-4">
                                {messageList.map((msg, index) => {
                                    const currentMessageTime = new Date(msg.timestamp);
                                    const nextMessage = index < messageList.length - 1 ? messageList[index + 1] : null;
                                    const nextMessageTime = nextMessage ? new Date(nextMessage.timestamp) : null;
                                    const nextMessageSenderId = nextMessage ? nextMessage.senderId : null;

                                    // Check if the next message is from the same sender and within the same minute
                                    const isLastMessageInMinute = !(nextMessageSenderId === msg.senderId &&
                                        nextMessageTime &&
                                        currentMessageTime.getMinutes() === nextMessageTime.getMinutes() &&
                                        currentMessageTime.getHours() === nextMessageTime.getHours());

                                    return (
                                        <div key={index} className={`flex ${(msg.senderId === selectedUser?.id) ? "justify-start" : "justify-end"}`}>
                                            <div className={`${(msg.imageUrl ? "bg-none" : (msg.senderId === selectedUser?.id) ? "bg-gray-300" : "bg-blue-600 text-white")} px-4 py-2 rounded-lg max-w-xs`}>
                                                {msg.content && <p>{msg.content}</p>}
                                                {msg.imageUrl && (
                                                    <LightGallery plugins={[lgZoom, lgThumbnail, lgVideo]} mode="lg-fade">
                                                        {(() => {
                                                            const isVideo = msg.imageUrl.includes('.mp4') || msg.imageUrl.includes('.mov') || msg.imageUrl.includes('.avi');
                                                            const mediaClass = 'max-w-full max-h-96 cursor-pointer object-cover rounded-lg';

                                                            return (
                                                                !isVideo ? (
                                                                    <a href={msg.imageUrl}>
                                                                        <img src={msg.imageUrl} alt="Hình ảnh" className={mediaClass} />
                                                                    </a>
                                                                ) : (
                                                                    <a href={msg.imageUrl} data-lg-size="1280-720">
                                                                        <video src={msg.imageUrl} controls className={mediaClass} />
                                                                    </a>
                                                                )
                                                            );
                                                        })()}
                                                    </LightGallery>
                                                )}

                                                {isLastMessageInMinute && (
                                                    <span className={`text-xs ${msg.imageUrl ? "text-gray-500" : (msg.senderId === selectedUser?.id) ? "text-gray-500" : "text-white"}`}>
                                                        {currentMessageTime.toLocaleString("en-US", {
                                                            year: "numeric",
                                                            month: "2-digit",
                                                            day: "2-digit",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            hour12: true
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>




                            {/* Khung nhập tin nhắn */}
                            {selectedUser && (
                                <div className="w-full bg-white border-t flex items-center p-4">
                                    <button
                                        onClick={() => imageInputRef.current.click()}
                                        title="Chọn ảnh"
                                        type="button" className="p-2 rounded-full  hover:bg-gray-300">
                                        <svg className='mx-auto' width="30" height="30" viewBox="-5 -2 30 25" xmlns="http://www.w3.org/2000/svg" fill="none">
                                            <path d="M3.15789 0H16.8421C17.6796 0 18.4829 0.332706 19.0751 0.924926C19.6673 1.51715 20 2.32037 20 3.15789V16.8421C20 17.6796 19.6673 18.4829 19.0751 19.0751C18.4829 19.6673 17.6796 20 16.8421 20H3.15789C2.32037 20 1.51715 19.6673 0.924926 19.0751C0.332706 18.4829 0 17.6796 0 16.8421V3.15789C0 2.32037 0.332706 1.51715 0.924926 0.924926C1.51715 0.332706 2.32037 0 3.15789 0ZM3.15789 1.05263C2.59954 1.05263 2.06406 1.27444 1.66925 1.66925C1.27444 2.06406 1.05263 2.59954 1.05263 3.15789V15.3579L5.56842 10.8316L8.2 13.4632L13.4632 8.2L18.9474 13.6842V3.15789C18.9474 2.59954 18.7256 2.06406 18.3308 1.66925C17.9359 1.27444 17.4005 1.05263 16.8421 1.05263H3.15789ZM8.2 14.9579L5.56842 12.3263L1.05263 16.8421C1.05263 17.4005 1.27444 17.9359 1.66925 18.3308C2.06406 18.7256 2.59954 18.9474 3.15789 18.9474H16.8421C17.4005 18.9474 17.9359 18.7256 18.3308 18.3308C18.7256 17.9359 18.9474 17.4005 18.9474 16.8421V15.1684L13.4632 9.69474L8.2 14.9579ZM5.78947 3.15789C6.48741 3.15789 7.15676 3.43515 7.65028 3.92867C8.1438 4.42218 8.42105 5.09154 8.42105 5.78947C8.42105 6.48741 8.1438 7.15676 7.65028 7.65028C7.15676 8.1438 6.48741 8.42105 5.78947 8.42105C5.09154 8.42105 4.42218 8.1438 3.92867 7.65028C3.43515 7.15676 3.15789 6.48741 3.15789 5.78947C3.15789 5.09154 3.43515 4.42218 3.92867 3.92867C4.42218 3.43515 5.09154 3.15789 5.78947 3.15789ZM5.78947 4.21053C5.37071 4.21053 4.9691 4.37688 4.67299 4.67299C4.37688 4.9691 4.21053 5.37071 4.21053 5.78947C4.21053 6.20824 4.37688 6.60985 4.67299 6.90596C4.9691 7.20207 5.37071 7.36842 5.78947 7.36842C6.20824 7.36842 6.60985 7.20207 6.90596 6.90596C7.20207 6.60985 7.36842 6.20824 7.36842 5.78947C7.36842 5.37071 7.20207 4.9691 6.90596 4.67299C6.60985 4.37688 6.20824 4.21053 5.78947 4.21053Z" fill="black" />
                                        </svg>
                                        <input
                                            type="file"
                                            ref={imageInputRef}
                                            accept="image/png, image/jpeg, image/gif, video/mp4"
                                            onChange={handleImageUpload}
                                            hidden
                                        />
                                    </button>
                                    <input
                                        type="text"
                                        placeholder="Nhập tin nhắn..."
                                        className="flex-1 p-2 border rounded-lg mx-2 focus:outline-none focus:ring-2 "
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault(); // Ngăn việc xuống dòng
                                                sendMessage(); // Gọi hàm gửi tin nhắn
                                            }
                                        }}
                                    />
                                    <button onClick={sendMessage}>
                                        <FontAwesomeIcon icon={faPaperPlane} size="lg" className="text-blue-600" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

        </div>
    );
}