// pages/support/[ticketId].tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';

type Props = { ticketId: string };

export default function TicketPage({
  ticketId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <div>Support ticket: {ticketId}</div>;
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { ticketId = '' } = (ctx.params ?? {}) as { ticketId?: string };
  // fetch data here if needed
  return { props: { ticketId } };
};
