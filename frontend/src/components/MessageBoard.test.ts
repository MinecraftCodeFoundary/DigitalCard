import type { Card } from '@/api/types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MessageBoard from './MessageBoard.vue'
import { cardApi } from '@/api/card'

vi.mock('@/api/card', () => ({ cardApi: { messages: vi.fn(), leaveMessage: vi.fn() } }))
const card: Card = { id: 'a'.repeat(24), name: '林予安', title: '', company: '', phone: '', email: '', wechat: '', location: '', bio: '', avatar: '', website: '', tags: [], theme: 'forest', published: true, updatedAt: '2026-10-10' }

describe('private message board', () => {
  it('keeps the draft on submission failure and prevents duplicate submission while pending', async () => {
    const wrapper = mount(MessageBoard, { props: { card } })
    await wrapper.find('input.message-name-input').setValue(' 陈小雨 ')
    await wrapper.find('input.message-contact-input').setValue(' hello@example.com ')
    await wrapper.find('textarea').setValue(' 期待合作 ')
    vi.mocked(cardApi.leaveMessage).mockRejectedValueOnce(new Error('网络暂时不可用'))
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('网络暂时不可用')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe(' 期待合作 ')
    let resolveSubmission!: (value: { submitted: true }) => void
    vi.mocked(cardApi.leaveMessage).mockImplementationOnce(() => new Promise((resolve) => {
      resolveSubmission = resolve
    }))
    await wrapper.find('.btn-primary').trigger('click')
    await wrapper.find('.btn-primary').trigger('click')
    expect(cardApi.leaveMessage).toHaveBeenCalledTimes(2)
    expect(cardApi.leaveMessage).toHaveBeenLastCalledWith(card.id, { name: '陈小雨', contact: 'hello@example.com', content: '期待合作' })
    resolveSubmission({ submitted: true })
    await flushPromises()
    expect(wrapper.text()).toContain('留言已送达')
    expect(cardApi.messages).not.toHaveBeenCalled()
  })
  it('shows an inbox only to the owner and preserves existing messages if loading more fails', async () => {
    const message = { id: 'b'.repeat(24), name: '<script>访客</script>', contact: '', content: 'hello\nworld', createdAt: '2026-10-10T10:00:00Z' }
    vi.mocked(cardApi.messages).mockResolvedValueOnce({ items: [message], total: 11, page: 1, pageSize: 10 })
    const wrapper = mount(MessageBoard, { props: { card, owner: true } })
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('.message-name').text()).toBe('<script>访客</script>')
    expect(wrapper.find('script').exists()).toBe(false)
    vi.mocked(cardApi.messages).mockRejectedValueOnce(new Error('加载失败'))
    await wrapper.find('.btn-secondary').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.message-item')).toHaveLength(1)
    expect(wrapper.text()).toContain('加载失败')
    vi.mocked(cardApi.messages).mockResolvedValueOnce({ items: [{ ...message, id: 'c'.repeat(24) }], total: 2, page: 2, pageSize: 10 })
    await wrapper.find('.btn-secondary').trigger('click')
    await flushPromises()
    expect(cardApi.messages).toHaveBeenLastCalledWith(2)
    expect(wrapper.findAll('.message-item')).toHaveLength(2)
  })
})
